import {Fragment} from 'react';
import styled from '@emotion/styled';

import Card from 'sentry/components/card';
import * as Layout from 'sentry/components/layouts/thirds';
import PanelTable from 'sentry/components/panels/panelTable';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatBytesBase2} from 'sentry/utils';
import useRouter from 'sentry/utils/useRouter';
import {CardSection} from 'sentry/views/performance/transactionSummary/transactionVitals/styles';

import s from './stats.json';

const stats = s as Record<string, any>;

enum BundleType {
  ASSETS = 'assets',
  IN_APP = 'in_app',
  PACKAGES = 'packages',
  OTHER = 'other',
}

const BUNDLE_TYPES = [
  {
    key: BundleType.ASSETS,
    label: t('Assets'),
  },
  {
    key: BundleType.IN_APP,
    label: t('In App'),
  },
  {
    key: BundleType.PACKAGES,
    label: t('Packages'),
  },
  // {
  //   key: BundleType.OTHER,
  //   label: t('Other'),
  // },
];

const chunks = stats.chunks;
const assets = stats.assets.sort((a, b) => b.size - a.size);
const modules = stats.modules;

const inAppModules = modules
  .filter(
    m =>
      m.moduleType.startsWith('javascript') &&
      m.name.startsWith('./') &&
      !m.name.endsWith('namespace object')
  )
  .sort((a, b) => b.size - a.size);

const packageModules = modules
  .filter(m => m.name.startsWith('../node_modules'))
  .sort((a, b) => b.size - a.size);

export default function BundleDetails() {
  const router = useRouter();
  const bundleType = router.location.query.bundleType ?? BundleType.ASSETS;

  function handleBundleAnalysisSelection(type: BundleType) {
    router.replace({
      ...router.location,
      query: {
        ...router.location.query,
        bundleType: type,
      },
    });
  }

  function getPanelItems() {
    switch (bundleType) {
      case BundleType.ASSETS: {
        return assets.map(asset => (
          <Fragment key={`asset-${asset.name}`}>
            <div>{asset.name}</div>
            <div>{formatBytesBase2(asset.size)}</div>
          </Fragment>
        ));
      }
      case BundleType.IN_APP: {
        return inAppModules.map(module => (
          <Fragment
            key={`module-${module.name}-${
              module?.chunks[0] ? module?.chunks[0] : '_sentry_no_chunk'
            }-${module?.reasons[0] ? module?.reasons[0].module : '_sentry_no_reason'}`}
          >
            <div>{module.name}</div>
            <div>{formatBytesBase2(module.size)}</div>
          </Fragment>
        ));
      }
      case BundleType.PACKAGES: {
        return packageModules.map(module => (
          <Fragment
            key={`module-${module.name}-${
              module?.chunks[0] ? module?.chunks[0] : '_sentry_no_chunk'
            }-${module?.reasons[0] ? module?.reasons[0].module : '_sentry_no_reason'}`}
          >
            <div>{module.name}</div>
            <div>{formatBytesBase2(module.size)}</div>
          </Fragment>
        ));
      }
      default: {
        throw new Error('Invalid bundle type');
      }
    }
  }

  const entrypoints = chunks.filter(c => c.entry);

  return (
    <Layout.Body>
      <Layout.Main fullWidth>
        <CardWrapper>
          {entrypoints.map(entrypoint => (
            <StyledCard key={entrypoint.id}>
              <CardSection>
                <div>{entrypoint.id}</div>
                <StatNumber>{formatBytesBase2(entrypoint.size)}</StatNumber>
              </CardSection>
            </StyledCard>
          ))}
        </CardWrapper>

        <SegmentedControlWrapper key="segmented-control">
          <SegmentedControl
            aria-label={t('Bundle Analysis Type')}
            size="sm"
            value={bundleType}
            onChange={key => handleBundleAnalysisSelection(key as BundleType)}
          >
            {BUNDLE_TYPES.map(({key, label}) => (
              <SegmentedControl.Item key={key} textValue={label}>
                {label}
              </SegmentedControl.Item>
            ))}
          </SegmentedControl>
        </SegmentedControlWrapper>

        <PanelTable headers={[t('Name'), t('Size')]}>{getPanelItems()}</PanelTable>
      </Layout.Main>
    </Layout.Body>
  );
}

const StyledCard = styled(Card)`
  margin-right: ${space(1)};
`;

const SegmentedControlWrapper = styled('div')`
  padding-bottom: ${space(2)};
`;

export const StatNumber = styled('div')`
  font-size: 32px;
`;

export const CardWrapper = styled('div')`
  display: flex;
`;
