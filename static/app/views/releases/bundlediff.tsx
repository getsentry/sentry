import {Fragment} from 'react';
import styled from '@emotion/styled';

import Card from 'sentry/components/card';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import PanelTable from 'sentry/components/panels/panelTable';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatBytesBase2} from 'sentry/utils';
import useRouter from 'sentry/utils/useRouter';
import {bundleStats as stats} from 'sentry/views/bundleAnalyzer';

const beforeStats = require('./stats.json');

import {CardSection} from 'sentry/views/performance/transactionSummary/transactionVitals/styles';

enum BundleType {
  ASSETS = 'assets',
  IN_APP = 'in_app',
  PACKAGES = 'packages',
  OTHER = 'other',
}

enum BundleState {
  REMOVED = 'removed',
  INCREASED = 'increased',
  NO_CHANGE = 'no_change',
  DECREASED = 'decreased',
  ADDED = 'added',
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

const chunks = stats.chunks.map(chunk => ({...chunk, name: chunk.id}));
const assets = stats.assets.sort((a, b) => b.size - a.size);
const modules = stats.modules;

const inAppModules = modules
  .filter(
    m =>
      m.moduleType.startsWith('javascript') &&
      m.name.startsWith('./app') &&
      !m.name.endsWith('namespace object')
  )
  .sort((a, b) => b.size - a.size);

const packageModules = modules
  .filter(m => m.name.startsWith('../node_modules'))
  .sort((a, b) => b.size - a.size);

const beforeChunks = beforeStats.chunks.map(chunk => ({...chunk, name: chunk.id}));
// const beforeAssets = beforeStats.assets.sort((a, b) => b.size - a.size);
const beforeModules = beforeStats.modules;

const beforeInAppModules = beforeModules
  .filter(
    m =>
      m.moduleType.startsWith('javascript') &&
      m.name.startsWith('./app') &&
      !m.name.endsWith('namespace object')
  )
  .sort((a, b) => b.size - a.size);

const beforePackageModules = beforeModules
  .filter(m => m.name.startsWith('../node_modules'))
  .sort((a, b) => b.size - a.size);

export default function BundleDiff() {
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
            <div>-</div>
            <div>-</div>
          </Fragment>
        ));
      }
      case BundleType.IN_APP: {
        return diff(beforeInAppModules, inAppModules)
          .filter(m => m.state !== BundleState.NO_CHANGE)
          .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
          .map(module => (
            <Fragment key={`module-${module.name}-${module.size}`}>
              <ExternalLink
                href={`https://github.com/getsentry/sentry/blob/master/static/${module.name.replace(
                  './',
                  ''
                )}`}
              >
                {module.name}
              </ExternalLink>
              <div>{formatBytesBase2(module.size)}</div>
              <div>{module.state}</div>
              <div>{(module.diff / module.size) * 100}</div>
            </Fragment>
          ));
      }
      case BundleType.PACKAGES: {
        return diff(beforePackageModules, packageModules)
          .filter(m => m.state !== BundleState.NO_CHANGE)
          .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
          .map(module => {
            const npmPackageName = getNpmPackageFromNodeModules(module.name);
            return (
              <Fragment key={`module-${module.name}-${module.size}`}>
                <ExternalLink href={`https://www.npmjs.com/package/${npmPackageName}`}>
                  {module.name.replace('../node_modules/', '')}
                </ExternalLink>
                <div>{formatBytesBase2(module.size)}</div>
                <div>{module.state}</div>
                <div>{(module.diff / module.size) * 100}</div>
              </Fragment>
            );
          });
      }
      default: {
        throw new Error('Invalid bundle type');
      }
    }
  }

  const beforeEntryPoints = beforeChunks.filter(c => c.entry);
  const entrypoints = chunks.filter(c => c.entry);

  // console.log(beforeEntryPoints);
  // console.log(entrypoints);

  return (
    <Layout.Body>
      <Layout.Main fullWidth>
        <CardWrapper>
          {diff(beforeEntryPoints, entrypoints).map(entrypoint => (
            <StyledCard key={entrypoint.name}>
              <CardSection>
                <div>{entrypoint.name}</div>
                <div>{entrypoint.state}</div>
                <div>{(entrypoint.diff / entrypoint.size) * 100}</div>
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

        <PanelTable headers={[t('Name'), t('Size'), t('Change'), t('Diff')]}>
          {getPanelItems()}
        </PanelTable>
      </Layout.Main>
    </Layout.Body>
  );
}

function getNpmPackageFromNodeModules(name: string): string {
  const path = name.replace('../node_modules/', '');
  const pathComponents = path.split('/');

  for (let i = pathComponents.length - 1; i >= 0; i--) {
    if (pathComponents[i] === 'node_modules') {
      const maybePackageName = pathComponents[i + 1];

      if (maybePackageName.startsWith('@')) {
        return maybePackageName + pathComponents[i + 2];
      }
      return maybePackageName;
    }
  }

  if (pathComponents[0].startsWith('@')) {
    return pathComponents[0] + pathComponents[1];
  }
  return pathComponents[0];
}

type Bundle = {
  name: string;
  size: number;
};

type DiffedBundle = {
  diff: number;
  name: string;
  size: number;
  state: BundleState;
};

function diff(before: Bundle[], after: Bundle[]): DiffedBundle[] {
  const diffed = new Map<string, DiffedBundle>();

  before.forEach(b => {
    diffed.set(b.name, {
      diff: 0,
      name: b.name,
      size: b.size,
      state: BundleState.REMOVED,
    });
  });

  after.forEach(a => {
    const beforeEntry = diffed.get(a.name);
    if (beforeEntry) {
      diffed.set(a.name, {
        diff: a.size - beforeEntry.size,
        name: a.name,
        size: a.size,
        state:
          a.size === beforeEntry.size
            ? BundleState.NO_CHANGE
            : a.size > beforeEntry.size
            ? BundleState.INCREASED
            : BundleState.DECREASED,
      });
    } else {
      diffed.set(a.name, {
        diff: 0,
        name: a.name,
        size: a.size,
        state: BundleState.ADDED,
      });
    }
  });

  return Array.from(diffed.values());
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
