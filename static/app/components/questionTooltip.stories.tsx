import {Fragment} from 'react';
import styled from '@emotion/styled';

import QuestionTooltip from 'sentry/components/questionTooltip';
import JSXNode from 'sentry/components/stories/jsxNode';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import storyBook from 'sentry/stories/storyBook';
import {space} from 'sentry/styles/space';

export default storyBook('QuestionTooltip', story => {
  story('Basics', () => {
    return (
      <Fragment>
        <p>
          The <JSXNode name="QuestionTooltip" /> component is a small{' '}
          <JSXNode name="IconQuestion" /> where you can specify a tooltip to go with it.
          It is useful for placing after headers and titles to include additional
          information. You'll see it often at the top of Sentry's pages, near the page
          titles.
        </p>
        <p>
          An example <JSXNode name="QuestionTooltip" /> looks like this:
        </p>
        <InlineContainer>
          <h3 style={{margin: 0}}>Most Dead Clicks</h3>
          <QuestionTooltip
            size="lg"
            position="top"
            title="The top selectors your users have dead clicked on (i.e., a user click that does not result in any page activity after 7 seconds)."
            isHoverable
          />
        </InlineContainer>
        <p>
          Required props are <JSXProperty name="size" value />, which specifies the size
          of the icon, and
          <JSXProperty name="title" value />, which specifies the tooltip content.
        </p>
      </Fragment>
    );
  });

  story('size', () => {
    return (
      <Fragment>
        <p>
          The <JSXProperty name="size" value /> prop specifies the size of the icon.
          Remember to keep the size relative to the text or content it is near. Valid
          values are
        </p>
        <IconExamples>
          <div>
            "xs" <QuestionTooltip size="xs" title="xs" />
          </div>
          <div>
            "sm" <QuestionTooltip size="sm" title="sm" />
          </div>
          <div>
            "md" <QuestionTooltip size="md" title="md" />
          </div>
          <div>
            "lg" <QuestionTooltip size="lg" title="lg" />
          </div>
          <div>
            "xl" <QuestionTooltip size="xl" title="xl" />
          </div>
          <div>
            "xxl" <QuestionTooltip size="xxl" title="xxl" />
          </div>
        </IconExamples>
      </Fragment>
    );
  });

  story('Additional props', () => {
    return (
      <Fragment>
        <p>
          Optionally, you can also specify a few other <JSXNode name="Tooltip" /> props:
        </p>
        <ul>
          <li>
            <JSXProperty name="containerDisplayMode" value />
          </li>
          <li>
            <JSXProperty name="isHoverable" value />
          </li>
          <li>
            <JSXProperty name="overlayStyle" value />
          </li>
          <li>
            <JSXProperty name="position" value />
          </li>
        </ul>
        <p>All the standard values for these props apply.</p>
      </Fragment>
    );
  });
});

const IconExamples = styled('div')`
  display: grid;
  gap: ${space(1)};
`;

const InlineContainer = styled('div')`
  display: flex;
  gap: ${space(0.5)};
  align-items: center;
`;
