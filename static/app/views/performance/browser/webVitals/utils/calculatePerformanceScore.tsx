import {Row} from 'sentry/views/performance/browser/webVitals/utils/types';

export const LCP_MAX_SCORE = 25;
export const FCP_MAX_SCORE = 10;
export const CLS_MAX_SCORE = 25;
export const LONG_TASK_MAX_SCORE = 30;

export type ProjectScore = {
  clsScore: number;
  fcpScore: number;
  lcpScore: number;
  tbtScore: number;
  totalScore: number;
};

export const calculatePerformanceScore = (
  row: Pick<
    Row,
    | 'p75(measurements.app_init_long_tasks)'
    | 'p75(measurements.cls)'
    | 'p75(measurements.fcp)'
    | 'p75(measurements.lcp)'
  >
): ProjectScore => {
  // dont have tbt so using long task duration sum
  const {
    'p75(measurements.lcp)': lcp,
    'p75(measurements.fcp)': fcp,
    'p75(measurements.app_init_long_tasks)': longTaskDuration,
    'p75(measurements.cls)': cls,
  } = row;

  const calculate = ({
    value,
    max,
    min,
    totalScore,
  }: {
    max: number;
    min: number;
    totalScore: number;
    value: number;
  }) => {
    const boundedValue = Math.min(max, Math.max(min, value));
    const range = max - min;
    const score = ((max - boundedValue) / range) * totalScore;
    return score;
  };

  const lcpScore = calculate({
    value: lcp,
    max: 8000,
    min: 1000,
    totalScore: LCP_MAX_SCORE,
  });
  const fcpScore = calculate({
    value: fcp,
    max: 6000,
    min: 1000,
    totalScore: FCP_MAX_SCORE,
  });
  const tbtScore = calculate({
    value: longTaskDuration,
    max: 3000,
    min: 0,
    totalScore: LONG_TASK_MAX_SCORE,
  });
  const clsScore = calculate({
    value: cls,
    max: 0.82,
    min: 0,
    totalScore: CLS_MAX_SCORE,
  });

  // Roughly based off google performance score
  // Adding 10 because we don't have a way to calculate speed index right now
  const totalScore = lcpScore + fcpScore + tbtScore + clsScore + 10;

  return {
    totalScore: Math.round(totalScore),
    lcpScore: Math.round((lcpScore * 100) / LCP_MAX_SCORE),
    fcpScore: Math.round((fcpScore * 100) / FCP_MAX_SCORE),
    tbtScore: Math.round((tbtScore * 100) / LONG_TASK_MAX_SCORE),
    clsScore: Math.round((clsScore * 100) / CLS_MAX_SCORE),
  };
};
