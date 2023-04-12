import styled from '@emotion/styled';

import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  ExceptionType,
  ExceptionValue,
  STACK_TYPE,
  STACK_VIEW,
  Thread,
} from 'sentry/types';

type NotifyOptions = {
  stackType?: STACK_TYPE;
  stackView?: STACK_VIEW;
};

type Props = {
  hasHierarchicalGrouping: boolean;
  exception?: ExceptionType;
  onChange?: (notifyOptions: NotifyOptions) => void;
  platform?: string;
  stackType?: STACK_TYPE;
  stackView?: STACK_VIEW;
  stacktrace?: ExceptionValue['stacktrace'];
  thread?: Thread;
};

function CrashActions({
  hasHierarchicalGrouping,
  stackView,
  stackType,
  stacktrace,
  thread,
  exception,
  platform,
  onChange,
}: Props) {
  const hasSystemFrames: boolean =
    stacktrace?.hasSystemFrames ||
    !!exception?.values?.find(value => !!value.stacktrace?.hasSystemFrames);

  const hasMinified = !stackType
    ? false
    : !!exception?.values?.find(value => value.rawStacktrace) || !!thread?.rawStacktrace;

  const setStackType = (type: STACK_TYPE) => {
    onChange?.({stackType: type});
  };

  const setStackView = (view: STACK_VIEW) => {
    onChange?.({stackView: view});
  };
  return (
    <ButtonGroupWrapper>
      <SegmentedControl
        aria-label={t('View')}
        size="xs"
        value={stackView}
        onChange={setStackView}
      >
        {[
          ...(hasSystemFrames
            ? [
                <SegmentedControl.Item
                  key={STACK_VIEW.APP}
                  tooltip={
                    hasHierarchicalGrouping &&
                    t(
                      'The stack trace only shows application frames and frames responsible for grouping this issue'
                    )
                  }
                >
                  {hasHierarchicalGrouping ? t('Most Relevant') : t('App Only')}
                </SegmentedControl.Item>,
              ]
            : []),
          <SegmentedControl.Item key={STACK_VIEW.FULL}>
            {t('Full')}
          </SegmentedControl.Item>,
          <SegmentedControl.Item key={STACK_VIEW.RAW}>{t('Raw')}</SegmentedControl.Item>,
        ]}
      </SegmentedControl>

      {hasMinified && (
        <SegmentedControl
          aria-label={t('Type')}
          size="xs"
          value={stackType}
          onChange={setStackType}
        >
          <SegmentedControl.Item key={STACK_TYPE.ORIGINAL}>
            {platform === 'javascript' || platform === 'node'
              ? t('Original')
              : t('Symbolicated')}
          </SegmentedControl.Item>
          <SegmentedControl.Item key={STACK_TYPE.MINIFIED}>
            {platform === 'javascript' || platform === 'node'
              ? t('Minified')
              : t('Unsymbolicated')}
          </SegmentedControl.Item>
        </SegmentedControl>
      )}
    </ButtonGroupWrapper>
  );
}

export default CrashActions;

const ButtonGroupWrapper = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(1)};
`;
