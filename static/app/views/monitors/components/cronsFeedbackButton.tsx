import {FeatureFeedback} from 'sentry/components/featureFeedback';

const CRONS_FEEDBACK_NAME = 'crons';

function CronsFeedbackButton() {
  return <FeatureFeedback featureName={CRONS_FEEDBACK_NAME} buttonProps={{size: 'sm'}} />;
}

export default CronsFeedbackButton;
