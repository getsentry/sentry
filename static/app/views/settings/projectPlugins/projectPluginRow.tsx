import {PureComponent} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';

import Access from 'sentry/components/acl/access';
import {ExternalLink, Link} from 'sentry/components/core/link';
import {Switch} from 'sentry/components/core/switch';
import {t} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import type {Plugin} from 'sentry/types/integrations';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import recreateRoute from 'sentry/utils/recreateRoute';
import withOrganization from 'sentry/utils/withOrganization';

const grayText = css`
  color: #979ba0;
`;

type Props = {
  onChange: (id: string, enabled: boolean) => void;
  organization: Organization;
  project: Project;
} & Plugin &
  Pick<RouteComponentProps, 'params' | 'routes'>;

class ProjectPluginRow extends PureComponent<Props> {
  handleChange = () => {
    const {onChange, id, enabled} = this.props;
    onChange(id, !enabled);
    const eventKey = enabled ? 'integrations.disabled' : 'integrations.enabled';
    trackIntegrationAnalytics(eventKey, {
      integration: id,
      integration_type: 'plugin',
      view: 'legacy_integrations',
      organization: this.props.organization,
    });
  };

  render() {
    const {
      id,
      name,
      slug,
      version,
      author,
      hasConfiguration,
      enabled,
      canDisable,
      project,
    } = this.props;

    const configureUrl = recreateRoute(id, this.props);
    return (
      <Access access={['project:write']} project={project}>
        {({hasAccess}) => {
          return (
            <Flex align="center" flex="1" key={id} className={slug}>
              <PluginInfo>
                <StyledPluginIcon size={48} pluginId={id} />
                <Stack justify="center">
                  <PluginName>
                    {`${name} `}
                    <Version>{version ? `v${version}` : <em>{t('n/a')}</em>}</Version>
                  </PluginName>
                  <div>
                    {author && (
                      <ExternalLink css={grayText} href={author.url}>
                        {author.name}
                      </ExternalLink>
                    )}
                    {hasConfiguration && (
                      <span>
                        {' '}
                        &middot;{' '}
                        <Link css={grayText} to={configureUrl}>
                          {hasAccess ? t('Configure plugin') : t('View plugin')}
                        </Link>
                      </span>
                    )}
                  </div>
                </Stack>
              </PluginInfo>
              <Switch
                size="lg"
                disabled={!hasAccess || !canDisable}
                checked={enabled}
                onChange={this.handleChange}
              />
            </Flex>
          );
        }}
      </Access>
    );
  }
}

export default withOrganization(ProjectPluginRow);

const PluginInfo = styled('div')`
  display: flex;
  flex: 1;
  line-height: 24px;
`;

const PluginName = styled('div')`
  font-size: 16px;
`;

const StyledPluginIcon = styled(PluginIcon)`
  margin-right: 16px;
`;

// Keeping these colors the same from old integrations page
const Version = styled('span')`
  color: #babec2;
`;
