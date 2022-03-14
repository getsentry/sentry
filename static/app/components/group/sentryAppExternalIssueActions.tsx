import * as React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {deleteExternalIssue} from 'sentry/actionCreators/platformExternalIssues';
import {Client} from 'sentry/api';
import {IntegrationLink} from 'sentry/components/issueSyncListElement';
import SentryAppComponentIcon from 'sentry/components/sentryAppComponentIcon';
import {IconAdd, IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {
  Group,
  PlatformExternalIssue,
  SentryAppComponent,
  SentryAppInstallation,
} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {recordInteraction} from 'sentry/utils/recordSentryAppInteraction';
import withApi from 'sentry/utils/withApi';

import SentryAppExternalIssueModal from './sentryAppExternalIssueModal';

type Props = {
  api: Client;
  event: Event;
  group: Group;
  sentryAppComponent: SentryAppComponent;
  sentryAppInstallation: SentryAppInstallation;
  externalIssue?: PlatformExternalIssue;
};

type State = {
  action: 'create' | 'link';
  externalIssue?: PlatformExternalIssue;
};

class SentryAppExternalIssueActions extends React.Component<Props, State> {
  state: State = {
    action: 'create',
    externalIssue: this.props.externalIssue,
  };

  componentDidUpdate(prevProps: Props) {
    if (this.props.externalIssue !== prevProps.externalIssue) {
      this.updateExternalIssue(this.props.externalIssue);
    }
  }

  updateExternalIssue(externalIssue?: PlatformExternalIssue) {
    this.setState({externalIssue});
  }

  doOpenModal = (e?: React.MouseEvent) => {
    // Only show the modal when we don't have a linked issue
    if (this.state.externalIssue) {
      return;
    }

    const {group, event, sentryAppComponent, sentryAppInstallation} = this.props;

    recordInteraction(
      sentryAppComponent.sentryApp.slug,
      'sentry_app_component_interacted',
      {
        componentType: 'issue-link',
      }
    );

    e?.preventDefault();
    openModal(
      deps => (
        <SentryAppExternalIssueModal
          {...deps}
          {...{group, event, sentryAppComponent, sentryAppInstallation}}
          onSubmitSuccess={this.onSubmitSuccess}
        />
      ),
      {allowClickClose: false}
    );
  };

  deleteIssue = () => {
    const {api, group} = this.props;
    const {externalIssue} = this.state;

    externalIssue &&
      deleteExternalIssue(api, group.id, externalIssue.id)
        .then(_data => {
          this.setState({externalIssue: undefined});
          addSuccessMessage(t('Successfully unlinked issue.'));
        })
        .catch(_error => {
          addErrorMessage(t('Unable to unlink issue.'));
        });
  };

  onAddRemoveClick = () => {
    const {externalIssue} = this.state;

    if (!externalIssue) {
      this.doOpenModal();
    } else {
      this.deleteIssue();
    }
  };

  onSubmitSuccess = (externalIssue: PlatformExternalIssue) => {
    this.setState({externalIssue});
  };

  render() {
    const {sentryAppComponent} = this.props;
    const {externalIssue} = this.state;
    const name = sentryAppComponent.sentryApp.name;

    let url = '#';
    let displayName: React.ReactNode | string = tct('Link [name] Issue', {name});

    if (externalIssue) {
      url = externalIssue.webUrl;
      displayName = externalIssue.displayName;
    }

    return (
      <IssueLinkContainer>
        <IssueLink>
          <StyledSentryAppComponentIcon sentryAppComponent={sentryAppComponent} />
          <IntegrationLink onClick={this.doOpenModal} href={url}>
            {displayName}
          </IntegrationLink>
        </IssueLink>
        <StyledIcon onClick={this.onAddRemoveClick}>
          {!!externalIssue ? <IconClose /> : <IconAdd />}
        </StyledIcon>
      </IssueLinkContainer>
    );
  }
}

const StyledSentryAppComponentIcon = styled(SentryAppComponentIcon)`
  color: ${p => p.theme.textColor};
  width: ${space(3)};
  height: ${space(3)};
  cursor: pointer;
  flex-shrink: 0;
`;

const IssueLink = styled('div')`
  display: flex;
  align-items: center;
  min-width: 0;
`;

const IssueLinkContainer = styled('div')`
  line-height: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const StyledIcon = styled('span')`
  color: ${p => p.theme.textColor};
  cursor: pointer;
`;

export default withApi(SentryAppExternalIssueActions);
