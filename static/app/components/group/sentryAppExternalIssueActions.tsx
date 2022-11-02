import {Component} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {deleteExternalIssue} from 'sentry/actionCreators/platformExternalIssues';
import {Client} from 'sentry/api';
import {IntegrationLink} from 'sentry/components/issueSyncListElement';
import SentryAppComponentIcon from 'sentry/components/sentryAppComponentIcon';
import Tooltip from 'sentry/components/tooltip';
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
  disabled?: boolean;
  externalIssue?: PlatformExternalIssue;
};

type State = {
  action: 'create' | 'link';
  externalIssue?: PlatformExternalIssue;
};

class SentryAppExternalIssueActions extends Component<Props, State> {
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
    const {sentryAppComponent, disabled} = this.props;
    const {externalIssue} = this.state;
    const name = sentryAppComponent.sentryApp.name;

    let url = '#';
    let displayName: React.ReactNode | string = tct('[name] Issue', {name});

    if (externalIssue) {
      url = externalIssue.webUrl;
      displayName = externalIssue.displayName;
    }

    return (
      <IssueLinkContainer>
        <IssueLink>
          <StyledSentryAppComponentIcon sentryAppComponent={sentryAppComponent} />
          <Tooltip
            title={tct('Unable to connect to [provider].', {
              provider: sentryAppComponent.sentryApp.name,
            })}
            disabled={!disabled}
          >
            <StyledIntegrationLink
              onClick={e => (disabled ? e.preventDefault() : this.doOpenModal())}
              href={url}
              disabled={disabled}
            >
              {displayName}
            </StyledIntegrationLink>
          </Tooltip>
        </IssueLink>
        <StyledIcon
          disabled={disabled}
          onClick={() => !disabled && this.onAddRemoveClick()}
        >
          {externalIssue ? (
            <IconClose aria-label={t('Remove')} />
          ) : (
            <IconAdd aria-label={t('Add')} />
          )}
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

const StyledIntegrationLink = styled(IntegrationLink)<{disabled?: boolean}>`
  color: ${({disabled, theme}) => (disabled ? theme.disabled : theme.textColor)};
`;

const IssueLinkContainer = styled('div')`
  line-height: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const StyledIcon = styled('span')<{disabled?: boolean}>`
  color: ${({disabled, theme}) => (disabled ? theme.disabled : theme.textColor)};
  cursor: pointer;
`;

export default withApi(SentryAppExternalIssueActions);
