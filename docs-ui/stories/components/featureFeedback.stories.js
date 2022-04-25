import {BrowserClient} from '@sentry/react';

import {FeatureFeedback} from 'sentry/components/featureFeedback';
import GlobalModal from 'sentry/components/globalModal';
import IndicatorContainer from 'sentry/components/indicators';
import {RouteContext} from 'sentry/views/routeContext';

export default {
  title: 'Components/FeatureFeedback',
};

export const _FeatureFeedback = () => {
  const router = {
    location: {
      query: {},
      pathname: '/mock-pathname/',
    },
    routes: [],
    params: {orgId: 'org-slug'},
  };

  // A workaround for this story to not send feedback events to Sentry
  // TODO: Check if there is a way to mock this in Storybook
  BrowserClient.prototype.captureEvent = () => {};

  return (
    <RouteContext.Provider
      value={{
        router,
        location: router.location,
        params: {},
        routes: [],
      }}
    >
      <FeatureFeedback
        featureName="test"
        feedbackTypes={[
          "I don't like this feature",
          'I like this feature',
          'Other reason',
        ]}
      />
      <GlobalModal />
      <IndicatorContainer />
    </RouteContext.Provider>
  );
};

_FeatureFeedback.storyName = 'FeatureFeedback';
_FeatureFeedback.parameters = {
  docs: {
    description: {
      story:
        'It includes a button that, when clicked, opens a modal that the user can use to send feedback to sentry',
    },
  },
};
