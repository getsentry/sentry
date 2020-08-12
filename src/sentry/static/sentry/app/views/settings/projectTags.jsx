import React from 'react';
import styled from '@emotion/styled';

import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {t, tct} from 'app/locale';
import Access from 'app/components/acl/access';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import {IconDelete} from 'app/icons';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ExternalLink from 'app/components/links/externalLink';
import LinkWithConfirmation from 'app/components/links/linkWithConfirmation';
import PermissionAlert from 'app/views/settings/project/permissionAlert';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import Tooltip from 'app/components/tooltip';
import routeTitleGen from 'app/utils/routeTitle';
import space from 'app/styles/space';

export default class ProjectTags extends AsyncView {
  getEndpoints() {
    const {projectId, orgId} = this.props.params;
    return [['tags', `/projects/${orgId}/${projectId}/tags/`]];
  }

  getTitle() {
    const {projectId} = this.props.params;
    return routeTitleGen(t('Tags'), projectId, false);
  }

  onDelete(key, idx) {
    const {projectId, orgId} = this.props.params;

    this.api.request(`/projects/${orgId}/${projectId}/tags/${key}/`, {
      method: 'DELETE',
      success: () => {
        const tags = this.state.tags.slice();
        tags.splice(idx, 1);
        this.setState({tags});
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
      },
    });
  }

  renderBody() {
    const {tags} = this.state;
    const isEmpty = !tags || tags.length === 0;

    return (
      <React.Fragment>
        <SettingsPageHeader title={t('Tags')} />
        <PermissionAlert />

        <TextBlock>
          {tct(
            `Each event in Sentry may be annotated with various tags (key and value pairs).
                 Learn how to [link:add custom tags].`,
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/enriching-error-data/additional-data/" />
              ),
            }
          )}
        </TextBlock>

        <Panel>
          <PanelHeader>{t('Tags')}</PanelHeader>

          <PanelBody>
            {isEmpty && (
              <EmptyMessage>
                {tct('There are no tags, [link:learn how to add tags]', {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/enriching-error-data/additional-data/" />
                  ),
                })}
              </EmptyMessage>
            )}

            <Access access={['project:write']}>
              {({hasAccess}) =>
                !isEmpty &&
                tags.map(({key, canDelete}, idx) => {
                  const enabled = canDelete && hasAccess;
                  return (
                    <TagPanelItem key={key} data-test-id="tag-row">
                      <TagName>{key}</TagName>

                      <Actions>
                        <Tooltip
                          disabled={enabled}
                          title={
                            hasAccess
                              ? t('This tag cannot be deleted.')
                              : t('You do not have permission to remove tags.')
                          }
                        >
                          <LinkWithConfirmation
                            title="Remove tag?"
                            message="Are you sure you want to remove this tag?"
                            onConfirm={() => this.onDelete(key, idx)}
                            disabled={!enabled}
                          >
                            <Button
                              size="xsmall"
                              icon={<IconDelete size="xs" />}
                              data-test-id="delete"
                              disabled={!enabled}
                            />
                          </LinkWithConfirmation>
                        </Tooltip>
                      </Actions>
                    </TagPanelItem>
                  );
                })
              }
            </Access>
          </PanelBody>
        </Panel>
      </React.Fragment>
    );
  }
}

const TagPanelItem = styled(PanelItem)`
  padding: 0;
  align-items: center;
`;

const TagName = styled('div')`
  flex: 1;
  padding: ${space(2)};
`;

const Actions = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(2)};
`;
