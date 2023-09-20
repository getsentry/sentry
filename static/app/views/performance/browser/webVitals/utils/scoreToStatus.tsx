export const scoreToStatus = (score: number) => {
  if (score >= 90) {
    return 'good';
  }
  if (score >= 50) {
    return 'needsImprovement';
  }
  return 'bad';
};

export const STATUS_TEXT = {
  good: 'Good',
  needsImprovement: 'Meh',
  bad: 'Poor',
};
