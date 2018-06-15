import {Box, Flex} from 'grid-emotion';
import React from 'react';

import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {t, tct} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/buttons/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ExternalLink from 'app/components/externalLink';
import LinkWithConfirmation from 'app/components/linkWithConfirmation';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import Tooltip from 'app/components/tooltip';

export default class ProjectTags extends AsyncView {
  getEndpoints() {
    let {projectId, orgId} = this.props.params;
    return [['tags', `/projects/${orgId}/${projectId}/tags/`]];
  }

  onDelete(key, idx) {
    let {projectId, orgId} = this.props.params;

    this.api.request(`/projects/${orgId}/${projectId}/tags/${key}/`, {
      method: 'DELETE',
      success: () => {
        let tags = this.state.tags.slice();
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

  renderLink(key, canDelete, idx) {
    return (
      <LinkWithConfirmation
        title={'Remove tag?'}
        message={'Are you sure you want to remove this tag?'}
        onConfirm={() => this.onDelete(key, idx)}
        disabled={!canDelete}
      >
        <Button size="xsmall" icon="icon-trash" />
      </LinkWithConfirmation>
    );
  }

  renderBody() {
    let {tags} = this.state;
    let isEmpty = !tags || tags.length === 0;

    return (
      <div>
        <SettingsPageHeader title={t('Tags')} />
        <TextBlock>
          {tct(
            `Each event in Sentry may be annotated with various tags (key and value pairs).
          Learn how to [link:add custom tags].`,
            {
              link: <ExternalLink href="https://docs.sentry.io/hosted/learn/context/" />,
            }
          )}
        </TextBlock>

        <Panel>
          <PanelHeader>
            <Flex>
              <Box flex="1">{t('Tags')}</Box>
            </Flex>
          </PanelHeader>

          <PanelBody>
            {isEmpty && (
              <EmptyMessage>
                {tct('There are no tags, [link:learn to add tags]', {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/hosted/learn/context/" />
                  ),
                })}
              </EmptyMessage>
            )}

            {!isEmpty &&
              tags.map(({key, canDelete}, idx) => {
                return (
                  <PanelItem p={0} align="center" key={key} className="ref-tag-row">
                    <Box align="flex-end" flex="1" p={2}>
                      <span>{key}</span>
                    </Box>
                    <Flex align="center" p={2}>
                      {canDelete ? (
                        this.renderLink(key, canDelete, idx)
                      ) : (
                        <Tooltip title={t('This tag cannot be deleted.')}>
                          <span>{this.renderLink(key, canDelete, idx)}</span>
                        </Tooltip>
                      )}
                    </Flex>
                  </PanelItem>
                );
              })}
          </PanelBody>
        </Panel>
      </div>
    );
  }
}
