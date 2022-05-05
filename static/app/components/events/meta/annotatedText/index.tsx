import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';

import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import Tooltip from 'sentry/components/tooltip';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Meta, MetaError} from 'sentry/types';

import Chunks from './chunks';
import {getTooltipText} from './utils';
import ValueElement from './valueElement';

type Props = {
  value: React.ReactNode;
  className?: string;
  meta?: Meta;
};

const AnnotatedText = ({value, meta, className, ...props}: Props) => {
  const renderValue = () => {
    if (meta?.chunks?.length && meta.chunks.length > 1) {
      return <Chunks chunks={meta.chunks} />;
    }

    const element = <ValueElement value={value} meta={meta} />;

    if (meta?.rem?.length) {
      const title = getTooltipText({rule_id: meta.rem[0][0], remark: meta.rem[0][1]});
      return <Tooltip title={title}>{element}</Tooltip>;
    }

    return element;
  };

  const formatErrorKind = (kind: string) => {
    return capitalize(kind.replace(/_/g, ' '));
  };

  const getErrorMessage = (error: MetaError) => {
    const errorMessage: string[] = [];

    if (Array.isArray(error)) {
      if (error[0]) {
        errorMessage.push(formatErrorKind(error[0]));
      }

      if (error[1]?.reason) {
        errorMessage.push(`(${error[1].reason})`);
      }
    } else {
      errorMessage.push(formatErrorKind(error));
    }

    return errorMessage.join(' ');
  };

  const getTooltipTitle = (errors: Array<MetaError>) => {
    if (errors.length === 1) {
      return <TooltipTitle>{t('Error: %s', getErrorMessage(errors[0]))}</TooltipTitle>;
    }
    return (
      <TooltipTitle>
        <span>{t('Errors:')}</span>
        <StyledList symbol="bullet">
          {errors.map((error, index) => (
            <ListItem key={index}>{getErrorMessage(error)}</ListItem>
          ))}
        </StyledList>
      </TooltipTitle>
    );
  };

  const renderErrors = (errors: Array<MetaError>) => {
    if (!errors.length) {
      return null;
    }

    return (
      <StyledTooltipError title={getTooltipTitle(errors)}>
        <StyledIconWarning color="red300" />
      </StyledTooltipError>
    );
  };

  return (
    <span className={className} {...props}>
      {renderValue()}
      {meta?.err && renderErrors(meta.err)}
    </span>
  );
};

export default AnnotatedText;

const StyledTooltipError = styled(Tooltip)`
  margin-left: ${space(0.75)};
  vertical-align: middle;
`;

const StyledList = styled(List)`
  li {
    padding-left: ${space(3)};
    word-break: break-all;
    :before {
      border-color: ${p => p.theme.white};
      top: 6px;
    }
  }
`;

const TooltipTitle = styled('div')`
  text-align: left;
`;

const StyledIconWarning = styled(IconWarning)`
  vertical-align: middle;
`;
