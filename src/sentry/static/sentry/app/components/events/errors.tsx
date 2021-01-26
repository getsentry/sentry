import React from 'react';
import {css} from '@emotion/core';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import isEqual from 'lodash/isEqual';
import uniqWith from 'lodash/uniqWith';

import {Client} from 'app/api';
import Button from 'app/components/button';
import EventErrorItem from 'app/components/events/errorItem';
import {IconWarning} from 'app/icons';
import {t, tn} from 'app/locale';
import space from 'app/styles/space';
import {Artifact, Organization, Project} from 'app/types';
import {Event} from 'app/types/event';
import {Theme} from 'app/utils/theme';
import withApi from 'app/utils/withApi';

import {BannerContainer, BannerSummary} from './styles';

const MAX_ERRORS = 100;

type Props = {
  api: Client;
  orgSlug: Organization['slug'];
  projectSlug: Project['slug'];
  event: Event;
};

type State = {
  isOpen: boolean;
  releaseArtifacts?: Array<Artifact>;
};

class EventErrors extends React.Component<Props, State> {
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

  checkSourceCodeErrors() {
    const {event} = this.props;
    const {errors} = event;

    const sourceCodeErrors = errors.filter(
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

  toggle = () => {
    this.setState(state => ({isOpen: !state.isOpen}));
  };

  uniqueErrors = (errors: any[]) => uniqWith(errors, isEqual);

  render() {
    const {event} = this.props;
    const {isOpen, releaseArtifacts} = this.state;
    const {dist} = event;

    // XXX: uniqueErrors is not performant with large datasets
    const errors =
      event.errors.length > MAX_ERRORS ? event.errors : this.uniqueErrors(event.errors);

    return (
      <StyledBanner priority="danger">
        <BannerSummary>
          <StyledIconWarning />
          <span>
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
          <ErrorList data-test-id="event-error-details">
            {errors.map((error, errorIdx) => {
              if (
                error.type === 'js_no_source' &&
                error.data.url &&
                !!releaseArtifacts?.length
              ) {
                const releaseArtifact = releaseArtifacts.find(releaseArt => {
                  const pathname = this.getURLPathname(error.data.url);
                  if (pathname) {
                    return releaseArt.name.includes(pathname);
                  }
                  return false;
                });

                if (releaseArtifact && !releaseArtifact.dist) {
                  error.message = t(
                    'Source code was not found because the distribution did not match'
                  );
                  error.data['expected-distribution'] = dist;
                  error.data['current-distribution'] = t('none');
                }
              }
              return <EventErrorItem key={errorIdx} error={error} />;
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

const ErrorList = styled('ul')`
  border-top: 1px solid ${customPink};
  margin: 0 ${space(3)} 0 ${space(4)};
  padding: ${space(1)} 0 ${space(0.5)} ${space(4)};

  li {
    margin-bottom: ${space(0.75)};
    word-break: break-word;
  }

  pre {
    background: #f9eded;
    color: #381618;
    margin: ${space(0.5)} 0 0;
  }
`;

export default withApi(EventErrors);
