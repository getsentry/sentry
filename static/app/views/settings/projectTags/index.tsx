import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Access from 'sentry/components/acl/access';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import EmptyMessage from 'sentry/components/emptyMessage';
import ExternalLink from 'sentry/components/links/externalLink';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'sentry/components/panels';
import {IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, TagWithTopValues} from 'sentry/types';
import routeTitleGen from 'sentry/utils/routeTitle';
import AsyncView from 'sentry/views/asyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import PermissionAlert from 'sentry/views/settings/project/permissionAlert';

type Props = RouteComponentProps<{projectId: string}, {}> & {
  organization: Organization;
} & AsyncView['props'];

type State = {
  tags: Array<TagWithTopValues>;
} & AsyncView['state'];

class ProjectTags extends AsyncView<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      tags: [],
    };
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {organization} = this.props;
    const {projectId} = this.props.params;
    return [['tags', `/projects/${organization.slug}/${projectId}/tags/`]];
  }

  getTitle() {
    const {projectId} = this.props.params;
    return routeTitleGen(t('Tags'), projectId, false);
  }

  handleDelete = (key: TagWithTopValues['key'], idx: number) => async () => {
    const {organization, params} = this.props;
    const {projectId} = params;

    try {
      await this.api.requestPromise(
        `/projects/${organization.slug}/${projectId}/tags/${key}/`,
        {
          method: 'DELETE',
        }
      );

      const tags = [...this.state.tags];
      tags.splice(idx, 1);
      this.setState({tags});
    } catch (error) {
      this.setState({error: true, loading: false});
    }
  };

  renderBody() {
    const {tags} = this.state;
    const isEmpty = !tags || !tags.length;

    return (
      <Fragment>
        <SettingsPageHeader title={t('Tags')} />
        <PermissionAlert />

        <TextBlock>
          {tct(
            `Each event in Sentry may be annotated with various tags (key and value pairs).
                 Learn how to [link:add custom tags].`,
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platform-redirect/?next=/enriching-events/tags/" />
              ),
            }
          )}
        </TextBlock>

        <Panel>
          <PanelHeader>{t('Tags')}</PanelHeader>
          <PanelBody>
            {isEmpty ? (
              <EmptyMessage>
                {tct('There are no tags, [link:learn how to add tags]', {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/product/sentry-basics/enrich-data/" />
                  ),
                })}
              </EmptyMessage>
            ) : (
              <Access access={['project:write']}>
                {({hasAccess}) =>
                  tags.map(({key, canDelete}, idx) => {
                    const enabled = canDelete && hasAccess;
                    return (
                      <TagPanelItem key={key} data-test-id="tag-row">
                        <TagName>{key}</TagName>
                        <Actions>
                          <Confirm
                            message={t('Are you sure you want to remove this tag?')}
                            onConfirm={this.handleDelete(key, idx)}
                            disabled={!enabled}
                          >
                            <Button
                              size="xs"
                              title={
                                enabled
                                  ? t('Remove tag')
                                  : hasAccess
                                  ? t('This tag cannot be deleted.')
                                  : t('You do not have permission to remove tags.')
                              }
                              aria-label={t('Remove tag')}
                              icon={<IconDelete size="xs" />}
                              data-test-id="delete"
                            />
                          </Confirm>
                        </Actions>
                      </TagPanelItem>
                    );
                  })
                }
              </Access>
            )}
          </PanelBody>
        </Panel>
      </Fragment>
    );
  }
}

export default ProjectTags;

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
