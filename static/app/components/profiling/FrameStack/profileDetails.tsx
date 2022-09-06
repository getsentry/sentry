import {useCallback, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import Button from 'sentry/components/button';
import DateTime from 'sentry/components/dateTime';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {FlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphPreferences';
import {useFlamegraphPreferencesValue} from 'sentry/utils/profiling/flamegraph/useFlamegraphPreferences';
import {
  useResizableDrawer,
  UseResizableDrawerOptions,
} from 'sentry/utils/profiling/hooks/useResizableDrawer';
import {ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import {makeFormatter} from 'sentry/utils/profiling/units/units';

import {ProfilingDetailsFrameTabs, ProfilingDetailsListItem} from './frameStack';

function renderValue(
  key: string,
  value: number | string | undefined,
  profileGroup: ProfileGroup
) {
  if (key === 'durationNS' && typeof value === 'number') {
    return nsFormatter(value);
  }
  if (key === 'threads') {
    return profileGroup.profiles.length;
  }
  if (key === 'received') {
    return <DateTime date={value} />;
  }
  if (value === undefined || value === '') {
    return t('ø');
  }

  return value;
}

interface ProfileDetailsProps {
  profileGroup: ProfileGroup;
}

export function ProfileDetails(props: ProfileDetailsProps) {
  const [detailsTab, setDetailsTab] = useState<'device' | 'transaction'>('transaction');

  const onDeviceTabClick = useCallback(() => {
    setDetailsTab('device');
  }, []);

  const onTransactionTabClick = useCallback(() => {
    setDetailsTab('transaction');
  }, []);

  const flamegraphPreferences = useFlamegraphPreferencesValue();
  const isResizableDetailsBar =
    flamegraphPreferences.layout === 'table left' ||
    flamegraphPreferences.layout === 'table right';

  const detailsBarRef = useRef<HTMLDivElement>(null);

  const resizableOptions: UseResizableDrawerOptions = useMemo(() => {
    const initialDimensions: [number, number] | [undefined, number] =
      flamegraphPreferences.layout === 'table bottom' ? [260, 200] : [0, 200];

    const onResize = (
      newDimensions: [number, number],
      maybeOldDimensions?: [number, number]
    ) => {
      if (!detailsBarRef.current) {
        return;
      }

      if (
        flamegraphPreferences.layout === 'table left' ||
        flamegraphPreferences.layout === 'table right'
      ) {
        detailsBarRef.current.style.width = `100%`;
        detailsBarRef.current.style.height =
          (maybeOldDimensions?.[1] ?? newDimensions[1]) + 'px';
      } else {
        detailsBarRef.current.style.height = ``;
        detailsBarRef.current.style.width = ``;
      }
    };

    return {
      initialDimensions,
      onResize,
      direction:
        flamegraphPreferences.layout === 'table bottom' ? 'horizontal-ltr' : 'vertical',
      min: [0, 26],
    };
  }, [flamegraphPreferences.layout]);

  const {onMouseDown} = useResizableDrawer(resizableOptions);

  return (
    <ProfileDetailsBar ref={detailsBarRef} layout={flamegraphPreferences.layout}>
      <ProfilingDetailsFrameTabs>
        <ProfilingDetailsListItem
          size="sm"
          className={detailsTab === 'transaction' ? 'active' : undefined}
        >
          <Button
            data-title={t('Transaction')}
            priority="link"
            size="zero"
            onClick={onTransactionTabClick}
          >
            {t('Transaction')}
          </Button>
        </ProfilingDetailsListItem>
        <ProfilingDetailsListItem
          size="sm"
          className={detailsTab === 'device' ? 'active' : undefined}
        >
          <Button
            data-title={t('Device')}
            priority="link"
            size="zero"
            onClick={onDeviceTabClick}
          >
            {t('Device')}
          </Button>
        </ProfilingDetailsListItem>
        <ProfilingDetailsListItem
          style={{
            flex: '1 1 100%',
            cursor: isResizableDetailsBar ? 'ns-resize' : undefined,
          }}
          onMouseDown={isResizableDetailsBar ? onMouseDown : undefined}
        />
      </ProfilingDetailsFrameTabs>

      {detailsTab === 'device' ? (
        <DetailsContainer>
          <DetailsRow>
            {Object.entries(DEVICE_DETAILS_KEY).map(([label, key]) => {
              const value = props.profileGroup.metadata[key];
              return (
                <DetailsRow key={key}>
                  <span>
                    <strong>{label}</strong>:
                  </span>{' '}
                  <span>{renderValue(key, value, props.profileGroup)}</span>
                </DetailsRow>
              );
            })}
          </DetailsRow>
        </DetailsContainer>
      ) : (
        <DetailsContainer>
          {Object.entries(PROFILE_DETAILS_KEY).map(([label, key]) => {
            const value = props.profileGroup.metadata[key];

            return (
              <DetailsRow key={key}>
                <strong>{label}</strong>:{' '}
                <span>
                  {renderValue(key, value, props.profileGroup)}
                  {key === 'platform' ? (
                    <PlatformIcon size={12} platform={value ?? 'unknown'} />
                  ) : null}
                </span>
              </DetailsRow>
            );
          })}
          <DetailsRow />
        </DetailsContainer>
      )}
    </ProfileDetailsBar>
  );
}

const nsFormatter = makeFormatter('nanoseconds');

const PROFILE_DETAILS_KEY: Record<string, string> = {
  [t('transaction')]: 'transactionName',
  [t('received at')]: 'received',
  [t('organization')]: 'organizationID',
  [t('project')]: 'projectID',
  [t('platform')]: 'platform',
  [t('environment')]: 'environment',
  [t('version')]: 'version',
  [t('duration')]: 'durationNS',
  [t('threads')]: 'threads',
};

const DEVICE_DETAILS_KEY: Record<string, string> = {
  [t('model')]: 'deviceModel',
  [t('manufacturer')]: 'deviceManufacturer',
  [t('classification')]: 'deviceClassification',
  [t('os')]: 'deviceOSName',
  [t('os version')]: 'deviceOSVersion',
  [t('locale')]: 'deviceLocale',
};

const DetailsRow = styled('div')`
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const DetailsContainer = styled('ul')`
  padding: ${space(1)};
  margin: 0;
  overflow: auto;
  position: absolute;
  left: 0;
  top: 24px;
  width: 100%;
  height: calc(100% - 24px);
`;

const ProfileDetailsBar = styled('div')<{layout: FlamegraphPreferences['layout']}>`
  width: ${p =>
    p.layout === 'table left' || p.layout === 'table right' ? '100%' : '260px'};
  height: ${p =>
    p.layout === 'table left' || p.layout === 'table right' ? '220px' : '100%'};
  border-left: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.background};
  grid-area: details;
  position: relative;

  > ul:first-child {
    border-bottom: 1px solid ${p => p.theme.border};
  }
`;
