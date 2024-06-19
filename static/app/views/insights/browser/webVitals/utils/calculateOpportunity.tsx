// Calculate the potential opportunity to increase projectScore by increasing transactionScore to 100
export const calculateOpportunity = (
  projectScore: number,
  totalCount: number,
  transactionScore: number,
  transactionCount: number
) => {
  const cumulativeProjectScore = projectScore * totalCount;
  const cumulativeComplementScore = (100 - transactionScore) * transactionCount;
  const cumulativeNewProjectScore = cumulativeProjectScore + cumulativeComplementScore;
  const newProjectScore = cumulativeNewProjectScore / totalCount;
  const opportunity = newProjectScore - projectScore;
  return Math.round(opportunity * 100) / 100;
};
