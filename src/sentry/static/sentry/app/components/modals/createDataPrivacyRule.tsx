import React from 'react';
import {css} from '@emotion/core';

import {Client} from 'app/api';
import {Organization, Project} from 'app/types';
import {Dialog} from 'app/components/dataPrivacyRules/dialog';
import theme from 'app/utils/theme';

type SourceSuggestions = React.ComponentProps<typeof Dialog>['sourceSuggestions'];

type Props = {
  organization: Organization;
  project: Project;
  eventId: string;
  onClose: () => void;
};

type State = {
  sourceSuggestions: SourceSuggestions;
};

class CreateDataPrivacyRule extends React.Component<Props, State> {
  state: State = {
    sourceSuggestions: [],
  };

  componentDidMount() {
    this.loadSourceSuggestionsEventBased();
  }
  componentWillUnmount() {
    this.api.clear();
  }

  api = new Client();

  loadSourceSuggestionsEventBased = async () => {
    const {organization, project, eventId} = this.props;

    const rawSuggestions = await this.api.requestPromise(
      `/organizations/${organization.slug}/data-scrubbing-selector-suggestions/`,
      {method: 'GET', query: {eventId, projectId: project.id}}
    );

    const sourceSuggestions: SourceSuggestions = rawSuggestions.suggestions;

    if (sourceSuggestions && sourceSuggestions.length > 0) {
      this.setState({
        sourceSuggestions,
      });
    }
  };

  render() {
    const {onClose, organization, project} = this.props;
    const {sourceSuggestions} = this.state;
    const endpoint = `/projects/${organization.slug}/${project.slug}/`;

    return (
      <Dialog
        api={this.api}
        endpoint={endpoint}
        onClose={onClose}
        sourceSuggestions={sourceSuggestions}
      />
    );
  }
}

const modalCss = css`
  .modal-dialog {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) !important;
    margin: 0;
    @media (max-width: ${theme.breakpoints[0]}) {
      width: 100%;
    }
  }
`;

export {modalCss, CreateDataPrivacyRule};
