import {Fragment} from 'react';
import {createPortal} from 'react-dom';
import {Link} from 'react-router';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence} from 'framer-motion';
import * as qs from 'query-string';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {space} from 'sentry/styles/space';
import {useHoverOverlay} from 'sentry/utils/useHoverOverlay';
import {useLocation} from 'sentry/utils/useLocation';
import {OverflowEllipsisTextContainer} from 'sentry/views/starfish/components/textAlign';
import {useFullSpanFromTrace} from 'sentry/views/starfish/queries/useFullSpanFromTrace';
import {ModuleName, StarfishFunctions} from 'sentry/views/starfish/types';
import {extractRoute} from 'sentry/views/starfish/utils/extractRoute';
import {SQLishFormatter} from 'sentry/views/starfish/utils/sqlish/SQLishFormatter';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

interface Props {
  moduleName: ModuleName;
  description?: string;
  endpoint?: string;
  endpointMethod?: string;
  group?: string;
}

const formatter = new SQLishFormatter();

export function SpanDescriptionCell({
  description,
  group,
  moduleName,
  endpoint,
  endpointMethod,
}: Props) {
  const location = useLocation();

  const hoverOverlayProps = useHoverOverlay('overlay', OVERLAY_OPTIONS);

  if (!description) {
    return NULL_DESCRIPTION;
  }

  const queryString = {
    ...location.query,
    endpoint,
    endpointMethod,
  };

  const sort: string | undefined = queryString?.[QueryParameterNames.SORT];

  // the spans page uses time_spent_percentage(local), so to persist the sort upon navigation we need to replace
  if (sort?.includes(`${StarfishFunctions.TIME_SPENT_PERCENTAGE}()`)) {
    queryString[QueryParameterNames.SORT] = sort.replace(
      `${StarfishFunctions.TIME_SPENT_PERCENTAGE}()`,
      `${StarfishFunctions.TIME_SPENT_PERCENTAGE}(local)`
    );
  }

  const formattedDescription =
    moduleName === ModuleName.DB ? formatter.toSimpleMarkup(description) : description;

  const overlayContent = moduleName === ModuleName.DB && hoverOverlayProps.isOpen && (
    <QueryDescriptionOverlay
      group={group}
      shortDescription={description}
      hoverOverlayProps={hoverOverlayProps}
    />
  );

  return (
    <Fragment>
      <OverflowEllipsisTextContainer>
        {hoverOverlayProps.wrapTrigger(
          group ? (
            <Link
              to={`/starfish/${extractRoute(location) ?? 'spans'}/span/${group}${
                queryString ? `?${qs.stringify(queryString)}` : ''
              }`}
            >
              {formattedDescription}
            </Link>
          ) : (
            formattedDescription
          )
        )}
      </OverflowEllipsisTextContainer>
      {createPortal(<AnimatePresence>{overlayContent}</AnimatePresence>, document.body)}
    </Fragment>
  );
}

const OVERLAY_OPTIONS = {position: 'right', isHoverable: true} as const;

const NULL_DESCRIPTION = <span>&lt;null&gt;</span>;

interface QueryDescriptionOverlayProps {
  hoverOverlayProps: ReturnType<typeof useHoverOverlay>;
  group?: string;
  shortDescription?: string;
}
function QueryDescriptionOverlay({
  group,
  shortDescription,
  hoverOverlayProps,
}: QueryDescriptionOverlayProps) {
  const theme = useTheme();

  const {
    data: fullSpan,
    isLoading,
    isFetching,
  } = useFullSpanFromTrace(group, Boolean(group));

  const description = fullSpan?.description ?? shortDescription;

  return description ? (
    <PositionWrapper zIndex={theme.zIndex.tooltip} {...hoverOverlayProps.overlayProps}>
      <OverlayContent
        animated
        originPoint={hoverOverlayProps.arrowData}
        arrowProps={hoverOverlayProps.arrowProps}
        placement={hoverOverlayProps.placement}
      >
        {/* N.B. A `disabled` query still returns `isLoading: true`, so we also
        check the fetching status explicitly. */}
        {isLoading && isFetching ? (
          <PaddedSpinner>
            <LoadingIndicator mini />
          </PaddedSpinner>
        ) : (
          <CodeSnippet language="sql">{formatter.toString(description)}</CodeSnippet>
        )}
      </OverlayContent>
    </PositionWrapper>
  ) : null;
}

const OverlayContent = styled(Overlay)`
  max-width: 500px;
`;

const PaddedSpinner = styled('div')`
  padding: ${space(1)};
`;
