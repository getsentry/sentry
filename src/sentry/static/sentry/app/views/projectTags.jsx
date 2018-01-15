import {Box, Flex} from 'grid-emotion';
import React from 'react';
import styled from 'react-emotion';

import {t} from '../locale';
import AsyncView from './asyncView';
import ExternalLink from '../components/externalLink';
import LinkWithConfirmation from '../components/linkWithConfirmation';
import Panel from './settings/components/panel';
import PanelBody from './settings/components/panelBody';
import PanelHeader from './settings/components/panelHeader';
import Row from './settings/components/row';
import SettingsPageHeader from './settings/components/settingsPageHeader';
import TextBlock from './settings/components/text/textBlock';
import Tooltip from '../components/tooltip';

const Description = styled.span`
  font-size: 0.8em;
  color: ${p => p.theme.gray1};
  margin-left: 8px;
`;

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
        className={'btn btn-sm btn-default'}
        title={'Remove tag?'}
        message={'Are you sure you want to remove this tag?'}
        onConfirm={() => this.onDelete(key, idx)}
        disabled={!canDelete}
      >
        <span className="icon icon-trash" />
      </LinkWithConfirmation>
    );
  }

  renderBody() {
    return (
      <div>
        <SettingsPageHeader title={t('Tags')} />
        <TextBlock>
          Each event in Sentry may be annotated with various tags (key and value pairs).
          Learn how to{' '}
          <ExternalLink href="https://docs.sentry.io/hosted/learn/context/">
            add custom tags
          </ExternalLink>
          .
        </TextBlock>

        <Panel>
          <PanelHeader>
            <Flex>
              <Box flex="1">{t('Tags')}</Box>
            </Flex>
          </PanelHeader>

          <PanelBody>
            {this.state.tags.map(({key, name}, idx) => {
              return (
                <Row key={key}>
                  <Box align="flex-end" flex="1" p={2}>
                    <span>{name}</span>
                    <Description>{key}</Description>
                  </Box>
                  <Flex align="center" p={2}>
                    <LinkWithConfirmation
                      className="btn btn-sm btn-default"
                      title={'Remove tag?'}
                      message={'Are you sure you want to remove this tag?'}
                      onConfirm={() => this.onDelete(key, idx)}
                    >
                      <span className="icon icon-trash" />
                    </LinkWithConfirmation>
                  </Flex>
                </Row>
              );
            })}
          </PanelBody>
        </Panel>
      </div>
    );
  }
}
