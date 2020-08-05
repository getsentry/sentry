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
import withConfig from 'app/utils/withConfig';

type Props = {
  api: Client;
  teamSlug: Team['slug'];
  members: Array<Member>;
  organization: Organization;
  canWrite: boolean;
  config: Config;
};

class Members extends React.Component<Props> {
  handleRemoveMember = (member: Member) => () => {};

  render() {
    const {members, canWrite, organization, config} = this.props;
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
        <Pagination pageLinks={pageLinks} />
      </React.Fragment>
    );
  }
}

export default withConfig(Members);

const StyledPanelItem = styled(PanelItem)`
  justify-content: space-between;
  align-items: center;
`;
