# Technical Spec — AI Product Comparison Advisor

**Dự án:** Trợ lý AI so sánh và tư vấn sản phẩm theo nhu cầu thật của khách hàng
**Đối tác:** Điện Máy Xanh — Vietnam Innovation Challenge 2026
**Phạm vi ưu tiên MVP:** ngành hàng Máy lạnh và Tủ lạnh (từ `Spec_cate_gia.xlsx`), kiến trúc mở rộng được cho 12 ngành hàng còn lại (Máy giặt, Tủ đông, Máy nước nóng, Đồng hồ thông minh, Máy tính bảng...).

---

## 1. Nguyên tắc kiến trúc

Ba yêu cầu bắt buộc từ đề bài chi phối toàn bộ thiết kế:

1. **Không hỏi lại thông tin đã có** — hệ thống phải nhớ được ngữ cảnh nhiều lượt.
2. **Không bịa thông số/giá/khuyến mãi** — mọi dữ liệu sản phẩm phải đến từ catalog thật, được lọc bằng code, LLM không được tự tra cứu hay suy diễn.
3. **Giải thích được trade-off bằng ngôn ngữ dễ hiểu** — LLM chỉ đóng vai trò diễn giải trên tập dữ liệu đã được lọc và xếp hạng sẵn, không tham gia vào quyết định sản phẩm nào được đưa vào top N.

Từ đó, hệ thống backend được chia thành **4 module tách biệt, có ranh giới rõ ràng**:

```
Tin nhắn khách hàng
   │
   ▼
┌─────────────────────────────────────────────────────────┐
│ 1. SLOT-FILLING                                          │
│   - Nhận diện category + trích xuất slot thô (LLM NLU)   │
│   - Canonical hoá field name & giá trị (code)             │
│   - Merge với conversation state cũ (code)                │
│   - Tính missing_slots (code, KHÔNG dùng LLM)             │
└─────────────────────────────────────────────────────────┘
   │
   ▼
   Đủ slot bắt buộc? ──── Chưa ──▶ Hỏi đúng slot còn thiếu
   │                                 (không hỏi lại slot đã trả lời)
   Đủ
   ▼
┌─────────────────────────────────────────────────────────┐
│ 2. RETRIEVAL / FILTER                                     │
│   - Query catalog thật (Excel → JSON/SQLite) bằng code    │
│   - Lọc theo slot đã đủ (budget, diện tích, số người...)  │
│   - Case 0 kết quả: nới ràng buộc hoặc báo rõ "chưa có"   │
└─────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────┐
│ 3. RANKING / EXPLANATION                                  │
│   - Rule-based scoring (không phải LLM) → chọn Top N      │
│   - LLM CHỈ nhận đúng Top N record (JSON) để diễn giải    │
│   - Prompt cấm LLM thêm thông tin ngoài record             │
└─────────────────────────────────────────────────────────┘
   │
   ▼
┌─────────────────────────────────────────────────────────┐
│ 4. VALIDATION (Guardrail)                                 │
│   - Đối chiếu số liệu LLM sinh ra với record gốc          │
│   - Chặn/sửa nếu có sai lệch giá, thông số, khuyến mãi    │
│   - Gắn nguồn dữ liệu (product_id, cột dữ liệu) vào output│
└─────────────────────────────────────────────────────────┘
   │
   ▼
Frontend hiển thị kết quả + trade-off + nguồn dữ liệu
   │
   └── khách phản hồi thêm ──▶ quay lại Module 1 (update state) ──▶ Module 2
```

**Ranh giới trách nhiệm quan trọng nhất:** LLM chỉ được gọi ở 2 chỗ — (a) trích xuất slot thô từ câu nói tự nhiên, và (b) diễn giải Top N đã lọc sẵn. LLM không bao giờ là nơi quyết định "sản phẩm nào tồn tại", "giá bao nhiêu", hay "còn hàng không".

---

## 2. Kiến trúc Backend & Frontend

### 2.1 Backend

- **Ngôn ngữ/runtime:** Node.js (JavaScript), kiến trúc module hoá theo 4 module ở trên, mỗi module là một thư mục độc lập trong `backend/src/`, có thể test unit riêng lẻ.
- **Không dùng framework nặng ở giai đoạn MVP** — chỉ cần một HTTP layer mỏng (Express) bọc quanh các module logic thuần (pure functions), để dễ test và dễ thay đổi giữa các milestone.
- **State store:** giai đoạn MVP dùng in-memory store theo `session_id` (Map), thiết kế interface để có thể thay bằng Redis khi lên pilot (đúng với gợi ý "Redis session" trong các thiết kế trước đó của nhóm).
- **Data layer:** đọc `Spec_cate_gia.xlsx` một lần khi khởi động, chuẩn hoá thành JSON theo từng category, đánh index theo các trường lọc chính (budget, category, các thuộc tính lọc riêng của ngành hàng). Không dùng dữ liệu Excel trực tiếp trong runtime query.
- **LLM integration:** gọi Anthropic API (`/v1/messages`) ở 2 điểm named ở trên; luôn truyền kèm `previous_state` + `missing_slots` (module 1) hoặc `top_n_records` (module 3) trong context — không bao giờ dựa vào trí nhớ của model.

### 2.2 Frontend

- Chat UI đơn giản (web), hiển thị:
  - Hội thoại dạng bong bóng chat.
  - Câu hỏi làm rõ (nếu còn thiếu slot) dưới dạng câu hỏi tự nhiên, có thể kèm quick-reply buttons cho các slot dạng enum (ví dụ: "phòng ngủ / phòng khách / phòng bếp").
  - Kết quả Top 3 dưới dạng card so sánh: tên, giá, ảnh, 2–3 lý do nên/không nên chọn, và **nguồn dữ liệu** (mã sản phẩm) để tăng độ tin cậy.
- Không xử lý logic nghiệp vụ ở frontend — frontend chỉ render state trả về từ backend.
- **Phạm vi lượt này:** không sửa frontend, chỉ chuẩn bị API contract để frontend integrate sau.

---

## 3. User Flow

```
1. Khách: "Em muốn mua máy lạnh dưới 20 triệu cho phòng 18m²"
2. Backend (Module 1): nhận diện category=máy lạnh, budget_max=20.000.000, room_area_m2=18
   → missing: installation_location, noise_priority (ưu tiên nếu muốn hỏi thêm)
3. Backend hỏi: "Anh/chị lắp cho phòng ngủ hay phòng khách ạ?"
4. Khách: "Phòng ngủ, ít bị nắng"
5. Backend (Module 1): merge installation_location=phòng ngủ, sun_exposure=false
   → đủ slot bắt buộc (category, budget_max, room_area_m2, installation_location)
6. Backend (Module 2): lọc catalog máy lạnh theo budget ≤ 20tr, phù hợp diện tích phòng
7. Backend (Module 3): rank theo độ khớp + LLM diễn giải Top 3
8. Backend (Module 4): validate số liệu LLM sinh ra khớp với record gốc
9. Frontend hiển thị Top 3 kèm lý do & nguồn dữ liệu
10. Khách: "Bỏ cái đầu tiên đi, cho xem rẻ hơn"
    → quay lại Module 1 (update excluded_ids, budget_max giảm) → Module 2 → ...
```

---

## 4. API Contract (dự kiến, cho milestone triển khai HTTP layer)

### `POST /api/conversation/message`

Request:
```json
{
  "session_id": "sess_abc123",
  "message": "Em muốn mua máy lạnh dưới 20 triệu cho phòng 18m2"
}
```

Response (khi còn thiếu slot):
```json
{
  "session_id": "sess_abc123",
  "status": "need_clarification",
  "reply": "Anh/chị lắp máy lạnh cho phòng ngủ hay phòng khách ạ?",
  "state": {
    "category": "may_lanh",
    "slots": { "budget_max": 20000000, "room_area_m2": 18 },
    "missing_slots": ["installation_location"]
  }
}
```

Response (khi đủ slot, đã có kết quả — thuộc phạm vi Module 2-4, chưa triển khai trong lượt này):
```json
{
  "session_id": "sess_abc123",
  "status": "ready",
  "state": { "category": "may_lanh", "slots": { "...": "..." }, "missing_slots": [] },
  "results": ["... thuộc Milestone 2 ..."]
}
```

### `GET /api/conversation/:session_id/state`
Trả về conversation state hiện tại — hỗ trợ debug và hỗ trợ frontend khôi phục phiên.

> Lưu ý: lượt triển khai này (Milestone 1) chỉ hiện thực hoá phần logic của Module 1 (`src/state`, `src/nlu`) dưới dạng pure function có test; HTTP layer (Express route) sẽ được nối dây ở milestone kế tiếp cùng với Module 2.

---

## 5. Product Schema & Conversation State

### 5.1 Product schema (nguồn: `Spec_cate_gia.xlsx`)

Mỗi sheet Excel là một category, dùng chung nhóm cột định danh:
`model_code, sku, productidweb, category_code, brand_id, brand, giá gốc, giá khuyến mãi, khuyến mãi quà`, cộng thêm các cột thông số riêng theo ngành hàng.

**Category `may_lanh` (Máy lạnh)** — các cột dùng để lọc/tư vấn chính:
`Loại máy, Công suất đầu ra, Phạm vi sử dụng (diện tích phòng), Độ ồn, Nhãn năng lượng, Công nghệ tiết kiệm điện, Tiện ích, giá gốc, giá khuyến mãi`.

**Category `tu_lanh` (Tủ lạnh)** — các cột dùng để lọc/tư vấn chính:
`Số người sử dụng, Dung tích tổng, Số cửa, Điện năng tiêu thụ, Công nghệ tiết kiệm điện, Kiểu dáng, Cao/Ngang/Sâu, giá gốc, giá khuyến mãi`.

Các ngành hàng còn lại (Máy giặt, Tủ đông, Máy nước nóng, Đồng hồ thông minh...) dùng chung cấu trúc nạp dữ liệu (`data/loadCatalog.js`), nhưng schema slot chi tiết cho từng ngành sẽ được bổ sung ở milestone mở rộng — hiện tại rơi vào schema mặc định (`category`, `budget_max`) để không chặn luồng hội thoại.

### 5.2 Slot schema (per category) — `backend/src/schema/categorySchemas.js`

```js
may_lanh: {
  required: ["category", "budget_max", "room_area_m2", "installation_location"],
  optional: ["budget_min", "noise_priority", "power_saving_priority", "sun_exposure", "promo_preference"],
}
tu_lanh: {
  required: ["category", "budget_max", "household_size"],
  optional: ["budget_min", "installation_location", "door_type_preference", "power_saving_priority"],
}
default: {
  required: ["category", "budget_max"],
  optional: ["budget_min"],
}
```

Mỗi slot có alias map để canonical hoá field từ output NLU thô, ví dụ:
`location | vị trí lắp | nơi lắp đặt → installation_location`
`area | diện tích | dien_tich → room_area_m2`
`budget | ngân sách | ngan_sach → budget_max`

### 5.3 Conversation state schema — `backend/src/state/conversationState.js`

```ts
ConversationState {
  session_id: string
  category: string | null
  slots: Record<string, string | number | boolean>   // chỉ chứa giá trị đã canonical & hợp lệ
  missing_slots: string[]                             // luôn tính lại bằng code sau mỗi turn
  asked_slots: string[]                                // slot đã từng được hỏi (chống hỏi lặp)
  rejected_fields: Array<{ field: string, reason: string, raw_value: any }>  // field sai/không nhận diện được — GIỮ LẠI để log, không âm thầm xoá
  turn_count: number
  updated_at: ISOString
}
```

Thiết kế quan trọng: **`rejected_fields` không bao giờ bị xoá âm thầm.** Khi NLU trả về một field không hợp lệ (sai kiểu dữ liệu) hoặc không nhận diện được (không có trong alias map), hệ thống giữ lại field đó kèm lý do, để có thể log/debug và để có thể hỏi lại khách xác nhận thay vì bỏ qua trong im lặng.

---

## 6. Kế hoạch triển khai theo milestone

| Milestone | Nội dung | Trạng thái |
|---|---|---|
| **M0 — Chuẩn bị dữ liệu** | Chuẩn hoá 2 sheet Máy lạnh & Tủ lạnh từ Excel thành schema lọc được; định nghĩa category schema | Song song với M1 |
| **M1 — Slot-filling & Conversation State** | Canonical NLU, chuẩn hoá `location → installation_location`, merge state, tính missing slots bằng code, chống hỏi lặp, không âm thầm bỏ field sai, prompt builder truyền previous state + missing slots cho LLM | ✅ Đã triển khai |
| **M2 — Retrieval/Filter** (lượt này) | Nạp catalog thật từ Excel vào bộ nhớ, parse các trường thông số dạng chuỗi tiếng Việt không đồng nhất, filter theo slot đã đủ bằng code, xử lý case 0 kết quả bằng cách nới ràng buộc theo trình tự định trước hoặc báo rõ "chưa có dữ liệu" | ✅ Triển khai trong lượt này |
| **M3 — Ranking/Explanation** | Rule-based scoring cho Top N, prompt LLM chỉ nhận đúng Top N JSON để diễn giải, cấm suy diễn ngoài record | Kế tiếp |
| **M4 — Validation/Guardrail** | Đối chiếu số liệu LLM sinh ra với record gốc, gắn nguồn dữ liệu vào output, chặn câu trả lời sai lệch | Kế tiếp |
| **M5 — HTTP layer + Frontend integration** | Nối Express route theo API contract ở mục 4, kết nối frontend chat UI | Kế tiếp |
| **M6 — Demo & pilot plan** | Chuẩn bị video demo, lộ trình pilot 1-2 trang theo yêu cầu D3 | Cuối cùng |

---

## 7. Việc đã triển khai trong lượt này (Milestone 1)

- `backend/src/schema/categorySchemas.js` — schema slot cho `may_lanh`, `tu_lanh`, `default` + alias map.
- `backend/src/nlu/canonicalize.js` — canonical hoá field/giá trị từ NLU thô; parse số từ chuỗi tiếng Việt (`"20 triệu"`, `"18m2"`); tách riêng `rejected_fields` thay vì xoá âm thầm.
- `backend/src/state/conversationState.js` — factory tạo state rỗng theo schema.
- `backend/src/state/merge.js` — merge slot mới vào state cũ, cộng dồn `rejected_fields`, không cho phép slot hợp lệ bị ghi đè bởi giá trị rác.
- `backend/src/state/missingSlots.js` — tính `missing_slots` bằng code, dựa 100% vào schema + state, không qua LLM.
- `backend/src/state/clarification.js` — chọn slot tiếp theo để hỏi, ưu tiên slot chưa từng hỏi, chống lặp câu hỏi khi state không đổi.
- `backend/src/nlu/promptBuilder.js` — build prompt cho LLM NLU, luôn nhúng `previous_state` + `missing_slots`, cấm hỏi lại slot đã có giá trị.
- `backend/tests/*.test.js` — test cho toàn bộ các module trên, gồm test chống lặp câu hỏi làm rõ qua nhiều lượt hội thoại giả lập.

## 8. Việc đã triển khai ở Milestone 2 (Retrieval/Filter)

- `backend/data/Spec_cate_gia.xlsx` — copy nguồn dữ liệu gốc vào repo để `loadCatalog` chạy được độc lập (không phụ thuộc đường dẫn upload tạm thời).
- `backend/src/data/parseSpecs.js` — các hàm parse thông số dạng chuỗi tiếng Việt không đồng nhất từ Excel (`"Từ 30 - 40m² (từ 80 đến 120m³)"`, `"Dàn lạnh: 45/34/29 dB - Dàn nóng: 51 dB"`, `"Trên 5 người"`, `"Đang cập nhật"`...) thành giá trị có cấu trúc (`{min, max}` hoặc số); parse không được → trả `null`, không suy diễn giá trị mặc định.
- `backend/src/data/loadCatalog.js` — đọc 2 sheet ưu tiên (Máy lạnh, Tủ Lạnh) từ `Spec_cate_gia.xlsx`, chuẩn hoá thành product object có `effective_price` (ưu tiên giá khuyến mãi, fallback giá gốc, `null` nếu cả hai đều thiếu — không bịa giá), giữ nguyên `_raw` row gốc để phục vụ trích dẫn nguồn dữ liệu ở Module 4.
- `backend/src/data/catalogStore.js` — cache catalog đã load, tránh đọc lại Excel mỗi lần gọi.
- `backend/src/retrieval/filterProducts.js` — module lọc bằng code (không dùng LLM), theo trình tự nới ràng buộc khi 0 kết quả:
  - Máy lạnh: `strict` (đúng ngân sách + diện tích) → `dropped_room_area_constraint` (bỏ ràng buộc diện tích) → `increased_budget_15pct` (nới ngân sách +15%) → `no_results` (báo rõ, không bịa sản phẩm).
  - Tủ lạnh: tương tự với `dropped_household_constraint` thay cho diện tích.
  - Sản phẩm không có `effective_price` (thiếu cả giá gốc lẫn giá khuyến mãi) luôn bị loại, không được đưa vào tư vấn.
- `backend/src/retrieveForState.js` — nối Module 1 (conversation state) với Module 2: chỉ gọi filter khi `missing_slots` rỗng, trả `not_ready` nếu state chưa đủ slot.
- `backend/tests/parseSpecs.test.js`, `loadCatalog.test.js`, `filterProducts.test.js`, `retrieveForState.test.js` — test unit cho từng hàm parse/filter, và test tích hợp end-to-end từ hội thoại slot-filling tới kết quả lọc trên catalog thật.
