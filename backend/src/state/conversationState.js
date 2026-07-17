'use strict';

/**
 * ConversationState — xem mô tả đầy đủ tại docs/technical-spec.md mục 5.3.
 *
 * {
 *   session_id: string
 *   category: string | null
 *   slots: Record<string, string|number|boolean>
 *   missing_slots: string[]
 *   asked_slots: string[]
 *   rejected_fields: Array<{ field: string, reason: string, raw_value: any }>
 *   turn_count: number
 *   updated_at: string (ISO)
 * }
 */

function createConversationState(sessionId) {
  return {
    session_id: sessionId,
    category: null,
    slots: {},
    missing_slots: [],
    asked_slots: [],
    rejected_fields: [],
    turn_count: 0,
    updated_at: new Date().toISOString(),
  };
}

module.exports = { createConversationState };
