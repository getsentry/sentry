import React from 'react';
import partition from 'lodash/partition';

import {openModal} from 'app/actionCreators/modal';
import ExternalLink from 'app/components/links/externalLink';
import {PlatformKey} from 'app/data/platformCategories';
import {t, tct} from 'app/locale';
import {Organization, Project} from 'app/types';
import {
  DynamicSamplingRule,
  DynamicSamplingRules,
  DynamicSamplingRuleType,
} from 'app/types/dynamicSampling';
import withProject from 'app/utils/withProject';
import AsyncView from 'app/views/asyncView';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import PermissionAlert from 'app/views/settings/organization/permissionAlert';

import ErrorRuleModal from './modals/errorRuleModal';
import TransactionRuleModal from './modals/transactionRuleModal';
import {modalCss} from './modals/utils';
import RulesPanel from './rulesPanel';
import {getPlatformDocLink} from './utils';

type Props = AsyncView['props'] & {
  project: Project;
  organization: Organization;
  hasAccess: boolean;
};

type State = AsyncView['state'] & {
  transactionRules: DynamicSamplingRules;
};

class FiltersAndSampling extends AsyncView<Props, State> {
  getTitle() {
    return t('Filters & Sampling');
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      transactionRules: [],
      project: null,
    };
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    // TODO(PRISCILA): it will come soon
    return [['', '']];
  }

  componentDidMount() {
    this.getRules();
  }

  getRules() {
    const dynamicSampling: DynamicSamplingRules = [
      {
        condition: {
          operator: 'globMatch',
          name: 'releases',
          value: ['1.1.1', '1.1.2'],
        },
        sampleRate: 0.7,
        ty: 'trace',
      },
      {
        condition: {
          operator: 'and',
          inner: [
            {
              operator: 'strEqualNoCase',
              name: 'environments',
              value: ['dev', 'prod'],
            },
            {
              operator: 'strEqualNoCase',
              name: 'userSegments',
              value: ['FirstSegment', 'SeCoNd'],
            },
          ],
        },
        sampleRate: 0.8,
        ty: 'error',
      },
      {
        condition: {
          operator: 'not',
          inner: {
            operator: 'strEqualNoCase',
            name: 'environments',
            value: ['dev', 'prod'],
          },
        },
        sampleRate: 0.8,
        ty: 'error',
      },
      {
        condition: {
          operator: 'strEqualNoCase',
          name: 'environments',
          value: ['dev', 'prod'],
        },
        sampleRate: 0.8,
        ty: 'error',
      },
    ] as DynamicSamplingRules;

    const [errorRules, transactionRules] = partition(
      dynamicSampling,
      rule => rule.ty === DynamicSamplingRuleType.ERROR
    );

    this.setState({errorRules, transactionRules});
  }

  handleSaveRule = async () => {
    // TODO(Priscila): Finalize this logic according to the new structure
  };

  handleAddErrorRule = (platformDocLink?: string) => () => {
    const {organization} = this.props;
    return openModal(
      modalProps => (
        <ErrorRuleModal
          {...modalProps}
          organization={organization}
          onSubmit={this.handleSaveRule}
          platformDocLink={platformDocLink}
        />
      ),
      {
        modalCss,
      }
    );
  };

  handleAddTransactionRule = (platformDocLink?: string) => () => {
    const {organization} = this.props;
    return openModal(
      modalProps => (
        <TransactionRuleModal
          {...modalProps}
          organization={organization}
          onSubmit={this.handleSaveRule}
          platformDocLink={platformDocLink}
        />
      ),
      {
        modalCss,
      }
    );
  };

  handleEditRule = (rule: DynamicSamplingRule) => () => {
    // TODO(Priscila): Finalize this logic according to the new structure
    // eslint-disable-next-line no-console
    console.log(rule);
  };

  handleDeleteRule = (rule: DynamicSamplingRule) => () => {
    // TODO(Priscila): Finalize this logic according to the new structure
    // eslint-disable-next-line no-console
    console.log(rule);
  };

  renderBody() {
    const {errorRules, transactionRules} = this.state;
    const {project, hasAccess} = this.props;

    const platformDocLink = getPlatformDocLink(project.platform as PlatformKey);
    const disabled = !hasAccess;

    return (
      <React.Fragment>
        <SettingsPageHeader title={this.getTitle()} />
        <PermissionAlert />
        <TextBlock>
          {platformDocLink
            ? tct(
                'Manage the inbound data you want to store. To change the sampling rate or rate limits, [link:update your SDK configuration]. The rules added below will apply on top of your SDK configuration.',
                {
                  link: <ExternalLink href={platformDocLink} />,
                }
              )
            : t(
                'Manage the inbound data you want to store. To change the sampling rate or rate limits, update your SDK configuration. The rules added below will apply on top of your SDK configuration.'
              )}
        </TextBlock>
        <RulesPanel
          rules={errorRules}
          platformDocLink={platformDocLink}
          onAddRule={this.handleAddErrorRule(platformDocLink)}
          onEditRule={this.handleEditRule}
          onDeleteRule={this.handleDeleteRule}
          disabled={disabled}
        />
        <TextBlock>
          {t(
            'The transaction order is limited. Traces must occur first and individual transactions must occur last. Any individual transaction rules before a trace rule will be disregarded. '
          )}
        </TextBlock>
        <RulesPanel
          rules={transactionRules}
          platformDocLink={platformDocLink}
          onAddRule={this.handleAddTransactionRule(platformDocLink)}
          onEditRule={this.handleEditRule}
          onDeleteRule={this.handleDeleteRule}
          disabled={disabled}
        />
      </React.Fragment>
    );
  }
}

export default withProject(FiltersAndSampling);
