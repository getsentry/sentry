export type SuspectCommitEventParameters = {
  'suspect-commit.feedback-submitted': {
    choice_selected: boolean;
    group_owner_id: number;
    user_id: string;
  };
};

type SuspectCommitEventKey = keyof SuspectCommitEventParameters;

export const suspectCommitEventMap: Record<SuspectCommitEventKey, string | null> = {
  'suspect-commit.feedback-submitted': 'Suspect Commit Feedback Submitted',
};
