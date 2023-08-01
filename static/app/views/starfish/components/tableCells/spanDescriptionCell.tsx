import {Fragment} from 'react';
import {createPortal} from 'react-dom';
import {Link} from 'react-router';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence} from 'framer-motion';
import * as qs from 'query-string';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {useHoverOverlay} from 'sentry/utils/useHoverOverlay';
import {useLocation} from 'sentry/utils/useLocation';
import {OverflowEllipsisTextContainer} from 'sentry/views/starfish/components/textAlign';
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

  const theme = useTheme();

  const {wrapTrigger, isOpen, overlayProps, placement, arrowData, arrowProps} =
    useHoverOverlay('overlay', OVERLAY_OPTIONS);

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

  const overlayContent = moduleName === ModuleName.DB && isOpen && (
    <PositionWrapper zIndex={theme.zIndex.tooltip} {...overlayProps}>
      <OverlayContent
        animated
        originPoint={arrowData}
        arrowProps={arrowProps}
        placement={placement}
      >
        <CodeSnippet language="sql">{formatter.toString(description)}</CodeSnippet>
      </OverlayContent>
    </PositionWrapper>
  );

  return (
    <Fragment>
      <OverflowEllipsisTextContainer>
        {wrapTrigger(
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

const NULL_DESCRIPTION = <span>&lt;null&gt;</span>;

const OVERLAY_OPTIONS = {position: 'right', isHoverable: true} as const;

const OverlayContent = styled(Overlay)`
  max-width: 500px;
`;
