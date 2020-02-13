import React from 'react';
import styled from '@emotion/styled';
import {RouteComponentProps} from 'react-router/lib/Router';

import {Organization, IntegrationFeature} from 'app/types';
import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import space from 'app/styles/space';
import Tag from 'app/views/settings/components/tag';
import PluginIcon from 'app/plugins/components/pluginIcon';
import InlineSvg from 'app/components/inlineSvg';
import Access from 'app/components/acl/access';
import Tooltip from 'app/components/tooltip';
import {getIntegrationFeatureGate} from 'app/utils/integrationUtil';
// import Alert, {Props as AlertProps} from 'app/components/alert';
// import ExternalLink from 'app/components/links/externalLink';
import {singleLineRenderer} from 'app/utils/marked';

// import {growDown, highlight} from 'app/styles/animations';
import IntegrationStatus from './integrationStatus';

type Tab = 'information' | 'configurations';

type State = {
  tab: Tab;
} & AsyncComponent['state'];

type Props = {
  organization: Organization;
} & RouteComponentProps<{orgId: string; integrationSlug: string}, {}> &
  AsyncComponent['props'];

class AbstractIntegrationDetailedView<
  P extends Props = Props,
  S extends State = State
> extends AsyncComponent<P, S> {
  tabs: Tab[] = ['information', 'configurations'];

  componentDidMount() {
    const {location} = this.props;
    const value =
      location.query.tab === 'configurations' ? 'configurations' : 'information';

    // eslint-disable-next-line react/no-did-mount-set-state
    this.setState({tab: value});
  }

  featureTags(features: string[]) {
    return features.map(feature => {
      feature = feature.replace(/integrations/g, '').replace(/-/g, ' ');
      return <StyledTag key={feature}>{feature}</StyledTag>;
    });
  }

  onTabChange = (value: Tab) => {
    this.setState({tab: value});
  };

  getTabDiplay(tab: Tab): string {
    return tab;
  }

  get installationStatus(): string {
    // Allow children to implement this
    throw new Error('Not implemented');
  }

  get integrationName(): string {
    // Allow children to implement this
    throw new Error('Not implemented');
  }

  get featureData(): IntegrationFeature[] {
    // Allow children to implement this
    throw new Error('Not implemented');
  }

  renderTopButton(_disabled: boolean): React.ReactElement {
    // Allow children to implement this
    throw new Error('Not implemented');
  }

  renderTopSection() {
    const {integrationSlug} = this.props.params;
    const {organization} = this.props;
    const featureData = this.featureData;

    // Prepare the features list
    const features = (featureData || []).map(f => ({
      featureGate: f.featureGate,
      description: (
        <span dangerouslySetInnerHTML={{__html: singleLineRenderer(f.description)}} />
      ),
    }));

    const {IntegrationFeatures} = getIntegrationFeatureGate();

    const featureProps = {organization, features};
    return (
      <Flex>
        <PluginIcon pluginId={integrationSlug} size={50} />
        <NameContainer>
          <Flex>
            <Name>{this.integrationName}</Name>
            <Status status={this.installationStatus} />
          </Flex>
          <Flex>
            {features.length && this.featureTags(features.map(f => f.featureGate))}
          </Flex>
        </NameContainer>
        <IntegrationFeatures {...featureProps}>
          {({disabled, disabledReason}) => (
            <div
              style={{
                marginLeft: 'auto',
                alignSelf: 'center',
              }}
            >
              {disabled && <DisabledNotice reason={disabledReason} />}

              <Access organization={organization} access={['org:integrations']}>
                {({hasAccess}) => (
                  <Tooltip
                    title={t(
                      'You must be an organization owner, manager or admin to install this.'
                    )}
                    disabled={hasAccess}
                  >
                    {this.renderTopButton(!hasAccess || !!disabled)}
                  </Tooltip>
                )}
              </Access>
            </div>
          )}
        </IntegrationFeatures>
      </Flex>
    );
  }

  renderTabs() {
    const {tab} = this.state;
    //TODO: Convert to styled component
    return (
      <ul className="nav nav-tabs border-bottom" style={{paddingTop: '30px'}}>
        {this.tabs.map(tabName => (
          <li
            key={tabName}
            className={tab === tabName ? 'active' : ''}
            onClick={() => this.onTabChange(tabName)}
          >
            <a style={{textTransform: 'capitalize'}}>{t(this.getTabDiplay(tabName))}</a>
          </li>
        ))}
      </ul>
    );
  }
}

const Flex = styled('div')`
  display: flex;
`;

const StyledTag = styled(Tag)`
  &:not(:first-child) {
    margin-left: ${space(0.5)};
  }
`;

const NameContainer = styled('div')`
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  justify-content: center;
  padding-left: ${space(2)};
`;

const Name = styled('div')`
  font-weight: bold;
  font-size: 1.4em;
  margin-bottom: ${space(1)};
`;

const DisabledNotice = styled(({reason, ...p}: {reason: React.ReactNode}) => (
  <div
    style={{
      flex: 1,
      alignItems: 'center',
    }}
    {...p}
  >
    <InlineSvg src="icon-circle-exclamation" size="1.5em" />
    <div style={{marginLeft: `${space(1)}`}}>{reason}</div>
  </div>
))`
  color: ${p => p.theme.red};
  font-size: 0.9em;
`;

// const Description = styled('div')`
//   font-size: 1.5rem;
//   line-height: 2.1rem;
//   margin-bottom: ${space(2)};

//   li {
//     margin-bottom: 6px;
//   }
// `;

// const Metadata = styled(Flex)`
//   font-size: 0.9em;
//   margin-bottom: ${space(2)};

//   a {
//     margin-left: ${space(1)};
//   }
// `;

// const AuthorName = styled('div')`
//   color: ${p => p.theme.gray2};
//   flex: 1;
// `;

// const NewInstallation = styled('div')`
//   overflow: hidden;
//   transform-origin: 0 auto;
//   animation: ${growDown('59px')} 160ms 500ms ease-in-out forwards,
//     ${p => highlight(p.theme.yellowLightest)} 1000ms 500ms ease-in-out forwards;
// `;

const StatusWrapper = styled('div')`
  margin-bottom: ${space(1)};
  padding-left: ${space(2)};
  line-height: 1.5em;
`;

const Status = p => (
  <StatusWrapper>
    <IntegrationStatus {...p} />
  </StatusWrapper>
);

// const InformationCard = ({children, alerts, information}: InformationCardProps) => {
//   const {metadata} = information;
//   const description = marked(metadata.description);
//   return (
//     <React.Fragment>
//       <Description dangerouslySetInnerHTML={{__html: description}} />
//       {children}
//       <Metadata>
//         <AuthorName>{t('By %s', information.metadata.author)}</AuthorName>
//         <div>
//           <ExternalLink href={metadata.source_url}>{t('View Source')}</ExternalLink>
//           <ExternalLink href={metadata.issue_url}>{t('Report Issue')}</ExternalLink>
//         </div>
//       </Metadata>

//       {alerts.map((alert, i) => (
//         <Alert key={i} type={alert.type} icon={alert.icon}>
//           <span dangerouslySetInnerHTML={{__html: singleLineRenderer(alert.text)}} />
//         </Alert>
//       ))}
//     </React.Fragment>
//   );
// };

// type InformationCardProps = {
//   children: React.ReactNode;
//   alerts: any | AlertType[];
//   information: IntegrationProvider;
// };

// type AlertType = AlertProps & {
//   text: string;
// };

// export default withOrganization(AbstractIntegrationDetailedView);
export default AbstractIntegrationDetailedView;
