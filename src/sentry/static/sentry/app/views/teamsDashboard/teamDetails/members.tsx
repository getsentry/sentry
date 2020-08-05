import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import {Client} from 'app/api';
import {Panel, PanelHeader, PanelBody, PanelItem} from 'app/components/panels';
import {IconFlag, IconSubtract} from 'app/icons';
import {t} from 'app/locale';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import Pagination from 'app/components/pagination';
import IdBadge from 'app/components/idBadge';
import {Organization, Team, Member, Config} from 'app/types';
import {leaveTeam} from 'app/actionCreators/teams';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import withConfig from 'app/utils/withConfig';

type Props = {
  api: Client;
  teamSlug: Team['slug'];
  members: Array<Member>;
  organization: Organization;
  canWrite: boolean;
  config: Config;
};

type State = {
  members: Array<Member>;
};

class Members extends React.Component<Props, State> {
  state: State = {
    members: this.props.members || [],
  };

  componentDidUpdate(prevProps: Props) {
    if (prevProps.members?.length !== this.props.members?.length) {
      this.getMembers();
    }
  }

  getMembers() {
    this.setState({members: this.props.members});
  }

  handleRemoveMember = (member: Member) => async () => {
    const {api, teamSlug, organization} = this.props;

    leaveTeam(
      api,
      {
        orgId: organization.slug,
        teamId: teamSlug,
        memberId: member.id,
      },
      {
        success: () => {
          this.setState(prevState => ({
            members: prevState.members.filter(m => m.id !== member.id),
          }));
          addSuccessMessage(t('Successfully removed member from team.'));
        },
        error: () => {
          addErrorMessage(
            t('There was an error while trying to remove a member from the team.')
          );
        },
      }
    );
  };

  render() {
    const {canWrite, organization, config} = this.props;
    const {members} = this.state;

    return (
      <React.Fragment>
        <Panel>
          <PanelHeader hasButtons>
            <div>{t('Members')}</div>
          </PanelHeader>
          <PanelBody>
            {members.length ? (
              members.map(member => {
                const isSelf = member.email === config.user.email;
                return (
                  <StyledPanelItem key={member.id}>
                    <IdBadge
                      avatarSize={36}
                      member={member}
                      useLink
                      orgId={organization.slug}
                    />
                    {(canWrite || isSelf) && (
                      <Button
                        size="small"
                        icon={<IconSubtract size="xs" isCircled />}
                        onClick={this.handleRemoveMember(member)}
                        label={t('Remove')}
                      >
                        {t('Remove')}
                      </Button>
                    )}
                  </StyledPanelItem>
                );
              })
            ) : (
              <EmptyMessage size="large" icon={<IconFlag size="xl" />}>
                {t('This team has no members')}
              </EmptyMessage>
            )}
          </PanelBody>
        </Panel>
        {/* <Pagination pageLinks={pageLinks} /> */}
      </React.Fragment>
    );
  }
}

export default withConfig(Members);

const StyledPanelItem = styled(PanelItem)`
  justify-content: space-between;
  align-items: center;
`;
