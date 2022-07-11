import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
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

const CrashActions = ({
  hasHierarchicalGrouping,
  stackView,
  stackType,
  stacktrace,
  thread,
  exception,
  platform,
  onChange,
}: Props) => {
  const hasSystemFrames: boolean =
    stacktrace?.hasSystemFrames ||
    !!exception?.values?.find(value => !!value.stacktrace?.hasSystemFrames);

  const hasMinified = !stackType
    ? false
    : !!exception?.values?.find(value => value.rawStacktrace) || !!thread?.rawStacktrace;

  const notify = (options: NotifyOptions) => {
    if (onChange) {
      onChange(options);
    }
  };

  const setStackType = (type: STACK_TYPE) => () => {
    notify({stackType: type});
  };

  const setStackView = (view: STACK_VIEW) => () => {
    notify({stackView: view});
  };

  const getOriginalButtonLabel = () => {
    if (platform === 'javascript' || platform === 'node') {
      return t('Original');
    }

    return t('Symbolicated');
  };

  const getMinifiedButtonLabel = () => {
    if (platform === 'javascript' || platform === 'node') {
      return t('Minified');
    }
    return t('Unsymbolicated');
  };

  return (
    <ButtonGroupWrapper>
      <ButtonBar active={stackView} merged>
        {hasSystemFrames && (
          <Button
            barId={STACK_VIEW.APP}
            size="xs"
            onClick={setStackView(STACK_VIEW.APP)}
            title={
              hasHierarchicalGrouping
                ? t(
                    'The stack trace only shows application frames and frames responsible for grouping this issue'
                  )
                : undefined
            }
          >
            {hasHierarchicalGrouping ? t('Most Relevant') : t('App Only')}
          </Button>
        )}
        <Button barId={STACK_VIEW.FULL} size="xs" onClick={setStackView(STACK_VIEW.FULL)}>
          {t('Full')}
        </Button>
        <Button barId={STACK_VIEW.RAW} onClick={setStackView(STACK_VIEW.RAW)} size="xs">
          {t('Raw')}
        </Button>
      </ButtonBar>
      {hasMinified && (
        <ButtonBar active={stackType} merged>
          <Button
            barId={STACK_TYPE.ORIGINAL}
            size="xs"
            onClick={setStackType(STACK_TYPE.ORIGINAL)}
          >
            {getOriginalButtonLabel()}
          </Button>
          <Button
            barId={STACK_TYPE.MINIFIED}
            size="xs"
            onClick={setStackType(STACK_TYPE.MINIFIED)}
          >
            {getMinifiedButtonLabel()}
          </Button>
        </ButtonBar>
      )}
    </ButtonGroupWrapper>
  );
};

export default CrashActions;

const ButtonGroupWrapper = styled('div')`
  display: flex;
  flex-wrap: wrap;
  > * {
    padding: ${space(0.5)} 0;
  }
  > *:not(:last-child) {
    margin-right: ${space(1)};
  }
`;
