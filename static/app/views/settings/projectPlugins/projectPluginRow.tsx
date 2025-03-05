import {PureComponent} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Access from 'sentry/components/acl/access';
import {Switch} from 'sentry/components/core/switch';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import type {Plugin} from 'sentry/types/integrations';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import getDynamicText from 'sentry/utils/getDynamicText';
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
    const eventKey = !enabled ? 'integrations.enabled' : 'integrations.disabled';
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
          const LinkOrSpan = hasAccess ? Link : 'span';

          return (
            <PluginItem key={id} className={slug}>
              <PluginInfo>
                <StyledPluginIcon size={48} pluginId={id} />
                <PluginDescription>
                  <PluginName>
                    {`${name} `}
                    {getDynamicText({
                      value: (
                        <Version>{version ? `v${version}` : <em>{t('n/a')}</em>}</Version>
                      ),
                      fixed: <Version>v10</Version>,
                    })}
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
                        <LinkOrSpan css={grayText} to={configureUrl}>
                          {t('Configure plugin')}
                        </LinkOrSpan>
                      </span>
                    )}
                  </div>
                </PluginDescription>
              </PluginInfo>
              <Switch
                size="lg"
                disabled={!hasAccess || !canDisable}
                checked={enabled}
                onChange={this.handleChange}
              />
            </PluginItem>
          );
        }}
      </Access>
    );
  }
}

export default withOrganization(ProjectPluginRow);

const PluginItem = styled('div')`
  display: flex;
  flex: 1;
  align-items: center;
`;

const PluginDescription = styled('div')`
  display: flex;
  justify-content: center;
  flex-direction: column;
`;

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
