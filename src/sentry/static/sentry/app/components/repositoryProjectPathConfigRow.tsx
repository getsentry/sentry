import React from 'react';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import {PanelItem} from 'app/components/panels';
import {Repository, RepositoryProjectPathConfig, Project} from 'app/types';
import {t} from 'app/locale';
import Access from 'app/components/acl/access';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import {IconDelete} from 'app/icons';
import space from 'app/styles/space';
import Tooltip from 'app/components/tooltip';
import IdBadge from 'app/components/idBadge';

type Props = {
  repoProjectPathConfig: RepositoryProjectPathConfig;
  repo: Repository;
  project: Project;
};

export default class RepositoryProjectPathConfigRow extends React.Component<Props> {
  api = new Client();

  deleteProjectPathConfig = () => {
    //TODO: Finish
  };

  render() {
    // TODO: Improve UI
    const {repoProjectPathConfig, repo, project} = this.props;

    return (
      <Access access={['org:integrations']}>
        {({hasAccess}) => (
          <StyledPanelItem>
            <Info>
              <StyledIdBadge
                project={project}
                avatarSize={20}
                displayName={project.slug}
                avatarProps={{consistentWidth: true}}
              />
              <Item>{repo.name}</Item>
              <Item>{repoProjectPathConfig.stackRoot}</Item>
              <Item>{repoProjectPathConfig.sourceRoot}</Item>
            </Info>
            <Tooltip
              title={t(
                'You must be an organization owner, manager or admin to remove a code mapping.'
              )}
              disabled={hasAccess}
            >
              <Confirm
                disabled={!hasAccess}
                onConfirm={this.deleteProjectPathConfig}
                message={t('Are you sure you want to remove this code mapping?')}
              >
                <Button
                  size="xsmall"
                  icon={<IconDelete size="xs" />}
                  label={t('delete')}
                  disabled={!hasAccess}
                />
              </Confirm>
            </Tooltip>
          </StyledPanelItem>
        )}
      </Access>
    );
  }
}

const StyledPanelItem = styled(PanelItem)`
  padding: ${space(1)} ${space(2)} ${space(2)};
  justify-content: space-between;
  align-items: center;
  flex: 1;
`;

const Info = styled('div')`
  display: flex;
`;

const Item = styled('span')`
  margin: 5px;
`;

const StyledIdBadge = styled(IdBadge)``;
