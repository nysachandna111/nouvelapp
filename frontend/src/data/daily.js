// Stable "practice of the day" — same pick for everyone on a given calendar day.
export function dailyPracticeIndex(listLength, date = new Date()) {
  if (!listLength) return 0;
  const daySeed = Math.floor(date.getTime() / 86400000);
  return daySeed % listLength;
}

export function pickDailyPractice(list, date = new Date()) {
  if (!list?.length) return null;
  return list[dailyPracticeIndex(list.length, date)];
}
