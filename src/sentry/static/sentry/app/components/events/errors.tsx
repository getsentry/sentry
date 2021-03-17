import React from 'react';
import {css} from '@emotion/core';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import isEqual from 'lodash/isEqual';
import uniqWith from 'lodash/uniqWith';

import {Client} from 'app/api';
import Button from 'app/components/button';
import ErrorItem from 'app/components/events/errorItem';
import List from 'app/components/list';
import {IconWarning} from 'app/icons';
import {t, tn} from 'app/locale';
import space from 'app/styles/space';
import {Artifact, Organization, Project} from 'app/types';
import {Event} from 'app/types/event';
import {Theme} from 'app/utils/theme';
import withApi from 'app/utils/withApi';

import {BannerContainer, BannerSummary} from './styles';

const MAX_ERRORS = 100;

export type Error = ErrorItem['props']['error'];

type Props = {
  api: Client;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
  proGuardErrors: Array<Error>;
  event: Event;
};

type State = {
  isOpen: boolean;
  releaseArtifacts?: Array<Artifact>;
};

class Errors extends React.Component<Props, State> {
  state: State = {
    isOpen: false,
  };

  componentDidMount() {
    this.checkSourceCodeErrors();
  }

  shouldComponentUpdate(nextProps: Props, nextState: State) {
    if (this.state.isOpen !== nextState.isOpen) {
      return true;
    }
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

  toggle = () => {
    this.setState(state => ({isOpen: !state.isOpen}));
  };

  render() {
    const {event, proGuardErrors} = this.props;
    const {isOpen, releaseArtifacts} = this.state;
    const {dist, errors: eventErrors = []} = event;

    // XXX: uniqWith returns unique errors and is not performant with large datasets
    const otherErrors: Array<Error> =
      eventErrors.length > MAX_ERRORS ? eventErrors : uniqWith(eventErrors, isEqual);

    const errors = [...otherErrors, ...proGuardErrors];

    return (
      <StyledBanner priority="danger">
        <BannerSummary>
          <StyledIconWarning />
          <span data-test-id="errors-banner-summary-info">
            {tn(
              'There was %s error encountered while processing this event',
              'There were %s errors encountered while processing this event',
              errors.length
            )}
          </span>
          <StyledButton
            data-test-id="event-error-toggle"
            priority="link"
            onClick={this.toggle}
          >
            {isOpen ? t('Hide') : t('Show')}
          </StyledButton>
        </BannerSummary>
        {isOpen && (
          <ErrorList data-test-id="event-error-details" symbol="bullet">
            {errors.map((error, errorIdx) => {
              const data = error.data ?? {};
              if (
                error.type === 'js_no_source' &&
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

                if (releaseArtifact && !releaseArtifact.dist) {
                  error.message = t(
                    'Source code was not found because the distribution did not match'
                  );
                  data['expected-distribution'] = dist;
                  data['current-distribution'] = t('none');
                }
              }
              return <ErrorItem key={errorIdx} error={{...error, data}} />;
            })}
          </ErrorList>
        )}
      </StyledBanner>
    );
  }
}

const linkStyle = ({theme}: {theme: Theme}) => css`
  font-weight: bold;
  color: ${theme.subText};
  :hover {
    color: ${theme.textColor};
  }
`;

const StyledButton = styled(Button)`
  ${linkStyle}
`;

const StyledBanner = styled(BannerContainer)`
  margin-top: -1px;
  a {
    ${linkStyle}
  }
`;

const StyledIconWarning = styled(IconWarning)`
  color: ${p => p.theme.red300};
`;

// TODO(theme) don't use a custom pink
const customPink = '#e7c0bc';

const ErrorList = styled(List)`
  border-top: 1px solid ${customPink};
  padding: ${space(1)} ${space(4)} ${space(0.5)} 40px;

  > li:before {
    top: 8px;
  }

  pre {
    background: #f9eded;
    color: #381618;
    margin: ${space(0.5)} 0 0;
  }
`;

export default withApi(Errors);
