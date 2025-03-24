import type {Cohort, PlanMigration as PlanMigrationType} from 'getsentry/types';
import {CohortId} from 'getsentry/types';

const SecondCohort: Cohort = {
  cohortId: CohortId.SECOND,
  nextPlan: {
    id: 'am1_team',
    name: 'Team',
    totalPrice: 4400,
    reservedErrors: 100000,
    reservedTransactions: 100000,
    reservedAttachments: 1,
    reserved: {errors: 100000, transactions: 100000, attachments: 1},
    errorCredits: 0,
    errorCreditsMonths: 0,
    discountAmount: 1500,
    discountMonths: 5,
    contractPeriod: 'monthly',
  },
  secondDiscount: 0,
};

const ThirdCohort: Cohort = {
  cohortId: CohortId.THIRD,
  nextPlan: {
    id: 'am2_team',
    name: 'Team',
    totalPrice: 4400,
    reservedErrors: 100000,
    reservedTransactions: 100000,
    reservedAttachments: 1,
    reserved: {errors: 100000, transactions: 100000, attachments: 1},
    errorCredits: 0,
    errorCreditsMonths: 0,
    discountAmount: 1800,
    discountMonths: 5,
    contractPeriod: 'monthly',
  },
  secondDiscount: 0,
};

const FourthCohort: Cohort = {
  cohortId: CohortId.FOURTH,
  nextPlan: {
    id: 'am2_team',
    name: 'Team',
    totalPrice: 48000,
    reservedErrors: 100000,
    reservedTransactions: 100000,
    reservedAttachments: 1,
    reserved: {errors: 100000, transactions: 100000, attachments: 1},
    errorCredits: 0,
    errorCreditsMonths: 0,
    discountAmount: 16800,
    discountMonths: 1,
    contractPeriod: 'annual',
  },
  secondDiscount: 2800,
};

const FifthCohort: Cohort = {
  cohortId: CohortId.FIFTH,
  nextPlan: {
    id: 'am2_business',
    name: 'Business',
    totalPrice: 48400,
    reservedErrors: 1_000_000,
    reservedTransactions: 100000,
    reservedAttachments: 1,
    reserved: {errors: 1_000_000, transactions: 100000, attachments: 1},
    errorCredits: 0,
    errorCreditsMonths: 0,
    discountAmount: 28500,
    discountMonths: 5,
    contractPeriod: 'monthly',
  },
  secondDiscount: 0,
};

const SixthCohort: Cohort = {
  cohortId: CohortId.SIXTH,
  nextPlan: {
    id: 'am2_team',
    name: 'Team',
    totalPrice: 4400,
    reservedErrors: 100000,
    reservedTransactions: 100000,
    reservedAttachments: 1,
    reserved: {errors: 100000, transactions: 100000, attachments: 1},
    errorCredits: 0,
    errorCreditsMonths: 0,
    discountAmount: 1800,
    discountMonths: 5,
    contractPeriod: 'monthly',
  },
  secondDiscount: 0,
};

const SeventhCohort: Cohort = {
  cohortId: CohortId.SEVENTH,
  nextPlan: {
    id: 'am2_business',
    name: 'Business',
    totalPrice: 523200,
    reservedErrors: 1_000_000,
    reservedTransactions: 100000,
    reservedAttachments: 1,
    reserved: {errors: 1_000_000, transactions: 100000, attachments: 1},
    errorCredits: 0,
    errorCreditsMonths: 0,
    discountAmount: 308400,
    discountMonths: 1,
    contractPeriod: 'annual',
  },
  secondDiscount: 51400,
};

const EighthCohort: Cohort = {
  cohortId: CohortId.EIGHTH,
  nextPlan: {
    id: 'am3_business',
    name: 'Business',
    totalPrice: 89_00,
    reservedErrors: 50_000,
    reservedAttachments: 1,
    reserved: {
      errors: 50_000,
      replays: 50,
      spans: 10_000_000,
      attachments: 1,
      monitorSeats: 1,
    },
    categoryCredits: {
      replays: {
        credits: 450,
        months: 2,
      },
    },
    errorCredits: 0,
    errorCreditsMonths: 0,
    discountAmount: 308400,
    discountMonths: 1,
    contractPeriod: 'monthly',
  },
  secondDiscount: 0,
};

const NinthCohort: Cohort = {
  cohortId: CohortId.NINTH,
  nextPlan: {
    id: 'am3_business',
    name: 'Business',
    totalPrice: 960_00,
    reservedErrors: 50_000,
    reservedAttachments: 1,
    reserved: {
      errors: 50_000,
      replays: 50,
      spans: 10_000_000,
      attachments: 1,
      monitorSeats: 1,
    },
    categoryCredits: {
      replays: {
        credits: 450,
        months: 2,
      },
    },
    errorCredits: 0,
    errorCreditsMonths: 0,
    discountAmount: 308400,
    discountMonths: 1,
    contractPeriod: 'annual',
  },
  secondDiscount: 0,
};

const TenthCohort: Cohort = {
  cohortId: CohortId.TENTH,
  nextPlan: {
    id: 'am3_business',
    name: 'Business',
    totalPrice: 960_00,
    reservedErrors: 50_000,
    reservedAttachments: 1,
    reserved: {
      errors: 50_000,
      replays: 50,
      spans: 10_000_000,
      attachments: 1,
      monitorSeats: 1,
    },
    errorCredits: 0,
    errorCreditsMonths: 0,
    discountAmount: 308400,
    discountMonths: 1,
    contractPeriod: 'annual',
  },
  secondDiscount: 0,
};

const CohortLookup: Record<CohortId, Cohort> = {
  [CohortId.SECOND]: SecondCohort,
  [CohortId.THIRD]: ThirdCohort,
  [CohortId.FOURTH]: FourthCohort,
  [CohortId.FIFTH]: FifthCohort,
  [CohortId.SIXTH]: SixthCohort,
  [CohortId.SEVENTH]: SeventhCohort,
  [CohortId.EIGHTH]: EighthCohort,
  [CohortId.NINTH]: NinthCohort,
  [CohortId.TENTH]: TenthCohort,
};

export function PlanMigrationFixture({
  cohortId,
  ...params
}: {cohortId: CohortId} & Partial<PlanMigrationType>): PlanMigrationType {
  return {
    id: 1,
    cohort: CohortLookup[cohortId] ?? null,
    dateApplied: null,
    planTier: 'am2',
    scheduled: false,
    effectiveAt: '',
    recurringCredits: [],
    ...params,
  };
}
