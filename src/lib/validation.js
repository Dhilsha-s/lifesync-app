/**
 * Input validation helpers for the onboarding form.
 * Each function returns { valid: boolean, message: string }.
 */

const NAME_MAX = 50;
const GOAL_MAX = 500;
// Allow letters (any script), spaces, hyphens, apostrophes, and periods.
const NAME_PATTERN = /^[\p{L}\s\-'.]+$/u;

/**
 * Validate the user's name.
 * - Must not be empty
 * - Max 50 characters
 * - Only letters, spaces, hyphens, apostrophes, and periods
 */
export function validateName(name) {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return { valid: false, message: 'Name is required.' };
  if (trimmed.length > NAME_MAX)
    return { valid: false, message: `Name must be ${NAME_MAX} characters or fewer.` };
  if (!NAME_PATTERN.test(trimmed))
    return {
      valid: false,
      message: 'Name can only contain letters, spaces, hyphens, and apostrophes.',
    };
  return { valid: true, message: '' };
}

/**
 * Validate the user's goal.
 * - Must not be empty
 * - Max 500 characters
 */
export function validateGoal(goal) {
  const trimmed = (goal ?? '').trim();
  if (!trimmed) return { valid: false, message: 'Goal is required.' };
  if (trimmed.length > GOAL_MAX)
    return { valid: false, message: `Goal must be ${GOAL_MAX} characters or fewer.` };
  return { valid: true, message: '' };
}

/**
 * Validate the deadline.
 * - Must not be empty
 * - Must be a parseable date
 * - Must be in the future (compared to today at midnight)
 */
export function validateDeadline(deadline) {
  if (!deadline) return { valid: false, message: 'Deadline is required.' };

  const parsed = new Date(deadline);
  if (isNaN(parsed.getTime()))
    return { valid: false, message: 'Deadline must be a valid date.' };

  // Compare against today at midnight (local time) to allow "today" as a boundary
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (parsed < today)
    return { valid: false, message: 'Deadline must be a future date.' };

  return { valid: true, message: '' };
}

export { NAME_MAX, GOAL_MAX };
