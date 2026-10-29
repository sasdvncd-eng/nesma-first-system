/**
 * Utilities for contract duration, end date calculation, and duration formatting.
 */

export function calculateContractEndDate(startDateStr: string, durationYears: number | string): string {
  if (!startDateStr) return '';
  const parts = startDateStr.split('-');
  if (parts.length !== 3) return '';
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1; // 0-based month
  const d = parseInt(parts[2], 10);

  if (isNaN(y) || isNaN(m) || isNaN(d)) return '';

  const duration = parseFloat(String(durationYears)) || 1;
  const totalMonthsToAdd = Math.round(duration * 12); // e.g. 6 for 0.5, 12 for 1, 24 for 2, 36 for 3

  const targetMonthTotal = m + totalMonthsToAdd;
  const targetYear = y + Math.floor(targetMonthTotal / 12);
  const targetMonth = targetMonthTotal % 12;

  // Clamp day to max days in target month
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const clampedDay = Math.min(d, daysInTargetMonth);

  const targetDate = new Date(targetYear, targetMonth, clampedDay);
  // Subtract 1 day for inclusive contract boundary (e.g. 2026-01-01 + 6 months -> 2026-06-30)
  targetDate.setDate(targetDate.getDate() - 1);

  const resYear = targetDate.getFullYear();
  const resMonth = String(targetDate.getMonth() + 1).padStart(2, '0');
  const resDay = String(targetDate.getDate()).padStart(2, '0');
  return `${resYear}-${resMonth}-${resDay}`;
}

export function getContractDurationYears(
  startDateStr?: string,
  endDateStr?: string,
  storedDuration?: string | number
): number {
  if (storedDuration !== undefined && storedDuration !== null && storedDuration !== '') {
    const parsed = parseFloat(String(storedDuration));
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  if (startDateStr && endDateStr) {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
      if (diffMonths <= 8) return 0.5;
      if (diffMonths <= 18) return 1;
      if (diffMonths <= 30) return 2;
      if (diffMonths <= 42) return 3;
      if (diffMonths <= 54) return 4;
      return 5;
    }
  }

  return 1;
}

export function formatContractDuration(durationYears?: string | number, isRtl: boolean = true): string {
  const durStr = String(durationYears || '1');
  if (durStr === '0.5') {
    return isRtl ? '6 شهور' : '6 Months';
  }
  if (durStr === '1') {
    return isRtl ? 'سنة واحدة' : '1 Year';
  }
  if (durStr === '2') {
    return isRtl ? 'سنتان' : '2 Years';
  }
  if (durStr === '3') {
    return isRtl ? '3 سنوات' : '3 Years';
  }
  if (durStr === '4') {
    return isRtl ? '4 سنوات' : '4 Years';
  }
  if (durStr === '5') {
    return isRtl ? '5 سنوات' : '5 Years';
  }
  return `${durStr} ${isRtl ? 'سنوات' : 'Yrs'}`;
}
