import {Fragment} from 'react';
import {BrowserClient} from '@sentry/react';

import {FeatureFeedback} from 'sentry/components/featureFeedback';
import TextField from 'sentry/components/forms/fields/textField';
import GlobalModal from 'sentry/components/globalModal';
import IndicatorContainer from 'sentry/components/indicators';
import {RouteContext} from 'sentry/views/routeContext';

export default {
  title: 'Components/Feature Feedback',
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
      <div className="section">
        <h3>Default</h3>
        <FeatureFeedback featureName="test" />
      </div>

      <div className="section">
        <h3>Custom</h3>
        <FeatureFeedback
          featureName="test"
          initialData={{step: 0, name: null, surname: null}}
        >
          {({Header, Body, Footer, state, onFieldChange}) => {
            if (state.step === 0) {
              return (
                <Fragment>
                  <Header>First Step</Header>
                  <Body>
                    <TextField
                      inline={false}
                      stacked
                      flexibleControlStateSize
                      label="Name"
                      value={state.name}
                      name="name"
                      onChange={value => onFieldChange('name', value)}
                    />
                  </Body>
                  <Footer onNext={() => onFieldChange('step', 1)} />
                </Fragment>
              );
            }

            return (
              <Fragment>
                <Header>Last Step</Header>
                <Body>
                  <TextField
                    required
                    inline={false}
                    stacked
                    flexibleControlStateSize
                    label="Surname"
                    value={state.surname}
                    name="surname"
                    onChange={value => onFieldChange('surname', value)}
                  />
                </Body>
                <Footer
                  onBack={() => onFieldChange('step', 0)}
                  primaryDisabled={!state.surname?.trim()}
                  submitEventData={{message: 'Feedback: test'}}
                />
              </Fragment>
            );
          }}
        </FeatureFeedback>
      </div>
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
