import {useEffect, useRef, useState} from 'react';

import {Button} from '@sentry/scraps/button';

import Feature from 'sentry/components/acl/feature';
import {
  useDataExport,
  type DataExportPayload,
} from 'sentry/components/exports/useDataExport';
import {t} from 'sentry/locale';
import type {OurLogFieldKey} from 'sentry/views/explore/logs/types';

export interface LogsQueryInfo {
  dataset: 'logs';
  field: OurLogFieldKey[];
  project: number[];
  query: string;
  sort: string[];
  end?: string;
  environment?: string[];
  limit?: number;
  start?: string;
  statsPeriod?: string;
}

interface DataExportProps {
  payload: DataExportPayload;
  children?: React.ReactNode;
  disabled?: boolean;
  icon?: React.ReactNode;
  onClick?: () => void;
  overrideFeatureFlags?: boolean;
  size?: 'xs' | 'sm' | 'md';
}

export function DataExport({
  children,
  disabled,
  payload,
  icon,
  size = 'sm',
  overrideFeatureFlags,
  onClick,
}: DataExportProps): React.ReactElement {
  const unmountedRef = useRef(false);
  const [inProgress, setInProgress] = useState(false);
  const handleDataExport = useDataExport({
    unmountedRef,
    inProgressCallback: setInProgress,
  });

  // We clear the indicator if export props change so that the user
  // can fire another export without having to wait for the previous one to finish.
  useEffect(() => {
    if (inProgress) {
      setInProgress(false);
    }
    // We are skipping the inProgress dependency because it would have fired on each handleDataExport
    // call and would have immediately turned off the value giving users no feedback on their click action.
    // An alternative way to handle this would have probably been to key the component by payload/queryType,
    // but that seems like it can be a complex object so tracking changes could result in very brittle behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload.queryType, payload.queryInfo]);

  // Tracking unmounting of the component to prevent setState call on unmounted component
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  const handleClick = () => {
    handleDataExport(payload);
    onClick?.();
  };

  return (
    <Feature features={overrideFeatureFlags ? [] : 'organizations:discover-query'}>
      {inProgress ? (
        <Button
          size={size}
          variant="secondary"
          tooltipProps={{
            title: t(
              "You can get on with your life. We'll email you when your data's ready."
            ),
          }}
          disabled
          icon={icon}
        >
          {t("We're working on it...")}
        </Button>
      ) : (
        <Button
          onClick={handleClick}
          disabled={disabled || false}
          size={size}
          variant="secondary"
          tooltipProps={{
            title: t(
              "Put your data to work. Start your export and we'll email you when it's finished."
            ),
          }}
          icon={icon}
        >
          {children ? children : t('Export All to CSV')}
        </Button>
      )}
    </Feature>
  );
}
