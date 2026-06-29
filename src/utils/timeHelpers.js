// backend/src/utils/timeHelpers.js

/**
 * Convert time string (HH:mm) to minutes since midnight
 */
export function timeToMinutes(timeStr) {
  if (!timeStr) return 0
  const [hours, minutes] = timeStr.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Convert minutes to hours (decimal)
 */
export function minutesToHours(minutes) {
  return minutes / 60
}

/**
 * Calculate regular hours worked within shift schedule
 */
export function calculateRegularHours(punchInTime, punchOutTime, scheduleStart, scheduleEnd) {
  const shiftStartMinutes = timeToMinutes(scheduleStart)
  const shiftEndMinutes = timeToMinutes(scheduleEnd)
  
  let shiftEndAdjusted = shiftEndMinutes
  if (shiftEndMinutes < shiftStartMinutes) {
    shiftEndAdjusted = shiftEndMinutes + 1440
  }
  
  let inMinutes = timeToMinutes(punchInTime)
  let outMinutes = timeToMinutes(punchOutTime)
  
  if (outMinutes < inMinutes) {
    outMinutes += 1440
  }
  
  const workStart = Math.max(inMinutes, shiftStartMinutes)
  const workEnd = Math.min(outMinutes, shiftEndAdjusted)
  
  if (workEnd <= workStart) return 0
  
  const totalMinutes = workEnd - workStart
  return minutesToHours(totalMinutes)
}

/**
 * Calculate overtime hours (beyond shift end)
 * Only counts the DURATION worked after shift end
 */
export function calculateOvertime(punchInTime, punchOutTime, scheduleEnd) {
  const inMinutes = timeToMinutes(punchInTime)
  const outMinutes = timeToMinutes(punchOutTime)
  const endMinutes = timeToMinutes(scheduleEnd)
  
  // Calculate the overlap between work time and overtime period
  let workStart = inMinutes
  let workEnd = outMinutes
  
  // If punch crosses midnight
  if (workEnd < workStart) {
    workEnd += 1440
  }
  
  // Overtime starts at shift end
  const overtimeStart = Math.max(workStart, endMinutes)
  
  // Calculate overtime duration (work after shift end)
  if (workEnd > overtimeStart) {
    const overtimeMinutes = workEnd - overtimeStart
    return minutesToHours(overtimeMinutes)
  }
  
  return 0
}

/**
 * Calculate night differential hours (22:00 - 06:00)
 */
export function calculateNightDiff(punchInTime, punchOutTime) {
  const NIGHT_START = 22 * 60
  const NIGHT_END = 6 * 60
  
  let inMinutes = timeToMinutes(punchInTime)
  let outMinutes = timeToMinutes(punchOutTime)
  
  if (outMinutes < inMinutes) {
    outMinutes += 1440
  }
  
  let nightMinutes = 0
  let current = inMinutes
  
  while (current < outMinutes) {
    const currentTime = current % 1440
    const isNight = currentTime >= NIGHT_START || currentTime < NIGHT_END
    
    if (isNight) {
      nightMinutes++
    }
    current++
  }
  
  return minutesToHours(nightMinutes)
}

/**
 * Calculate late minutes - for the FIRST punch in only
 */
export function calculateLate(punchInTime, scheduleStart) {
  const inMinutes = timeToMinutes(punchInTime)
  const startMinutes = timeToMinutes(scheduleStart)
  
  if (inMinutes > startMinutes) {
    return inMinutes - startMinutes
  }
  return 0
}

/**
 * Calculate undertime - for the LAST punch out only
 */
export function calculateUndertime(totalWorkMinutes, shiftStart, shiftEnd) {
  const startMinutes = timeToMinutes(shiftStart)
  const endMinutes = timeToMinutes(shiftEnd)
  
  // Calculate shift duration
  let shiftDuration = endMinutes - startMinutes
  if (shiftDuration < 0) {
    shiftDuration += 1440 // Crosses midnight
  }
  
  // Undertime is the difference between shift duration and total work
  const undertimeMinutes = shiftDuration - totalWorkMinutes
  
  // Only positive undertime (if you worked less than shift)
  return Math.max(0, undertimeMinutes)
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDate() {
  const now = new Date()
  return now.toISOString().split('T')[0]
}

/**
 * Convert timestamp to date string
 */
export function toDateString(timestamp) {
  if (timestamp instanceof Date) {
    return timestamp.toISOString().split('T')[0]
  }
  return new Date(timestamp).toISOString().split('T')[0]
}