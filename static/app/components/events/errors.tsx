import {Component} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import isEqual from 'lodash/isEqual';
import uniqWith from 'lodash/uniqWith';

import {Client} from 'sentry/api';
import Alert from 'sentry/components/alert';
import ErrorItem from 'sentry/components/events/errorItem';
import List from 'sentry/components/list';
import {JavascriptProcessingErrors} from 'sentry/constants/eventErrors';
import {t, tn} from 'sentry/locale';
import {Artifact, Organization, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';
import withApi from 'sentry/utils/withApi';

import {DataSection} from './styles';

const MAX_ERRORS = 100;

export type Error = ErrorItem['props']['error'];

type Props = {
  api: Client;
  event: Event;
  orgSlug: Organization['slug'];
  proGuardErrors: Array<Error>;
  projectSlug: Project['slug'];
};

type State = {
  releaseArtifacts?: Array<Artifact>;
};

class Errors extends Component<Props, State> {
  state: State = {};

  componentDidMount() {
    this.checkSourceCodeErrors();
  }

  shouldComponentUpdate(nextProps: Props) {
    return this.props.event.id !== nextProps.event.id;
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.event.id !== prevProps.event.id) {
      this.checkSourceCodeErrors();
    }
  }

  async fetchReleaseArtifacts(query: string) {
    const {api, orgSlug, event, projectSlug} = this.props;
    const {release} = event;
    const releaseVersion = release?.version;

    if (!releaseVersion || !query) {
      return;
    }

    try {
      const releaseArtifacts = await api.requestPromise(
        `/projects/${orgSlug}/${projectSlug}/releases/${encodeURIComponent(
          releaseVersion
        )}/files/?query=${query}`,
        {
          method: 'GET',
        }
      );

      this.setState({releaseArtifacts});
    } catch (error) {
      Sentry.captureException(error);
      // do nothing, the UI will not display extra error details
    }
  }

  checkSourceCodeErrors() {
    const {event} = this.props;
    const {errors} = event;

    const sourceCodeErrors = (errors ?? []).filter(
      error => error.type === 'js_no_source' && error.data.url
    );

    if (!sourceCodeErrors.length) {
      return;
    }

    const pathNames: Array<string> = [];

    for (const sourceCodeError of sourceCodeErrors) {
      const url = sourceCodeError.data.url;
      if (url) {
        const pathName = this.getURLPathname(url);

        if (pathName) {
          pathNames.push(encodeURIComponent(pathName));
        }
      }
    }

    this.fetchReleaseArtifacts(pathNames.join('&query='));
  }

  getURLPathname(url: string) {
    try {
      return new URL(url).pathname;
    } catch {
      return undefined;
    }
  }

  render() {
    const {event, proGuardErrors} = this.props;
    const {releaseArtifacts} = this.state;
    const {dist: eventDistribution, errors: eventErrors = []} = event;

    // XXX: uniqWith returns unique errors and is not performant with large datasets
    const otherErrors: Array<Error> =
      eventErrors.length > MAX_ERRORS ? eventErrors : uniqWith(eventErrors, isEqual);

    const errors = [...otherErrors, ...proGuardErrors];

    return (
      <StyledDataSection>
        <StyledAlert
          type="error"
          showIcon
          data-test-id="event-error-alert"
          expand={[
            <ErrorList
              key="event-error-details"
              data-test-id="event-error-details"
              symbol="bullet"
            >
              {errors.map((error, errorIdx) => {
                const data = error.data ?? {};
                if (
                  error.type === JavascriptProcessingErrors.JS_MISSING_SOURCE &&
                  data.url &&
                  !!releaseArtifacts?.length
                ) {
                  const releaseArtifact = releaseArtifacts.find(releaseArt => {
                    const pathname = data.url ? this.getURLPathname(data.url) : undefined;

                    if (pathname) {
                      return releaseArt.name.includes(pathname);
                    }
                    return false;
                  });

                  const releaseArtifactDistribution = releaseArtifact?.dist ?? null;

                  // Neither event nor file have dist -> matching
                  // Event has dist, file doesn’t -> not matching
                  // File has dist, event doesn’t -> not matching
                  // Both have dist, same value -> matching
                  // Both have dist, different values -> not matching
                  if (releaseArtifactDistribution !== eventDistribution) {
                    error.message = t(
                      'Source code was not found because the distribution did not match'
                    );
                    data['expected-distribution'] = eventDistribution;
                    data['current-distribution'] = releaseArtifactDistribution;
                  }
                }

                return <ErrorItem key={errorIdx} error={{...error, data}} />;
              })}
            </ErrorList>,
          ]}
        >
          {tn(
            'There was %s problem processing this event',
            'There were %s problems processing this event',
            errors.length
          )}
        </StyledAlert>
      </StyledDataSection>
    );
  }
}

const StyledDataSection = styled(DataSection)`
  border-top: none;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    padding-top: 0;
  }
`;

const StyledAlert = styled(Alert)`
  margin-bottom: 0;
`;

const ErrorList = styled(List)`
  li:last-child {
    margin-bottom: 0;
  }
`;

export default withApi(Errors);
