import {Flex} from 'grid-emotion';
import {Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';

import {t} from 'app/locale';
import DynamicWrapper from 'app/components/dynamicWrapper';
import ExternalLink from 'app/components/links/externalLink';
import Access from 'app/components/acl/access';
import PluginIcon from 'app/plugins/components/pluginIcon';
import SentryTypes from 'app/sentryTypes';
import Switch from 'app/components/switch';
import recreateRoute from 'app/utils/recreateRoute';

const grayText = css`
  color: #979ba0;
`;

class ProjectPluginRow extends React.PureComponent {
  static propTypes = {
    ...SentryTypes.Plugin,
    onChange: PropTypes.func,
  };

  handleChange = () => {
    const {onChange, id, enabled} = this.props;
    onChange(id, !enabled);
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
    } = this.props;

    const configureUrl = recreateRoute(id, this.props);
    return (
      <Access access={['project:write']}>
        {({hasAccess}) => {
          const LinkOrSpan = hasAccess ? Link : 'span';

          return (
            <Flex key={id} className={slug} flex="1" align="center">
              <PluginInfo>
                <StyledPluginIcon size={48} pluginId={id} />
                <Flex justify="center" direction="column">
                  <PluginName>
                    {`${name} `}
                    <DynamicWrapper
                      value={
                        <Version>{version ? `v${version}` : <em>{t('n/a')}</em>}</Version>
                      }
                      fixed={<Version>v10</Version>}
                    />
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
                </Flex>
              </PluginInfo>
              <Switch
                size="lg"
                isDisabled={!hasAccess || !canDisable}
                isActive={enabled}
                toggle={this.handleChange}
              />
            </Flex>
          );
        }}
      </Access>
    );
  }
}

export default ProjectPluginRow;

// Includes icon, name, version, configure link
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
