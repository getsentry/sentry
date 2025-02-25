import {Fragment} from 'react';

import {AlertLink, type AlertLinkProps} from 'sentry/components/core/alert/alertLink';
import JSXNode from 'sentry/components/stories/jsxNode';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import {IconMail} from 'sentry/icons';
import StoryBook from 'sentry/stories/storyBook';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/alert/alertLink';

const DUMMY_LINK = '/stories';

const ALERT_LINK_VARIANTS: Array<AlertLinkProps['type']> = [
  'info',
  'warning',
  'success',
  'error',
  'muted',
];

export default StoryBook('AlertLink', Story => {
  Story.APIReference(types.AlertLink);
  Story('Default', () => {
    return (
      <Fragment>
        <p>
          The <JSXNode name="AlertLink" /> component is a type of <JSXNode name="Alert" />
          . The primary use case is when you want the entire alert to be a link.
        </p>
        <p>
          The default <JSXNode name="AlertLink" /> looks like this:
        </p>
        <AlertLink.Container>
          {ALERT_LINK_VARIANTS.map(variant => (
            <AlertLink key={variant} type={variant} to={DUMMY_LINK}>
              Clicking this link will not open in a new tab!
            </AlertLink>
          ))}
        </AlertLink.Container>
      </Fragment>
    );
  });

  Story('Internal, External, and Manual Links', () => {
    return (
      <Fragment>
        <p>
          The <JSXNode name="AlertLink" /> component can be used as an external link, an
          internal link, or a manual link (by specifying a{' '}
          <JSXProperty name="onClick" value /> prop). Currently, only the{' '}
          <JSXNode name="ExternalLink" /> component supports the{' '}
          <JSXProperty name="openInNewTab" value /> prop - this prop is not supported for
          internal or manual links.{' '}
        </p>

        <p>
          AlertLink as an external link using{' '}
          <JSXProperty name="href" value={`https://santry.io${DUMMY_LINK}`} />
          and <JSXProperty name="openInNewTab" value />:
        </p>
        <AlertLink type="info" href={`https://santry.io/${DUMMY_LINK}`} openInNewTab>
          Info Link
        </AlertLink>
        <p>
          AlertLink as an internal link using <JSXProperty name="to" value={DUMMY_LINK} />
          :
        </p>
        <AlertLink type="info" to={DUMMY_LINK}>
          Info Link
        </AlertLink>
        <p>
          AlertLink as a manual link using{' '}
          <JSXProperty name="onClick" value={`() => window.alert('Clicked!')`} />:
        </p>
        {/* eslint-disable-next-line */}
        <AlertLink type="info" onClick={() => window.alert('Clicked!')}>
          Info Link
        </AlertLink>
      </Fragment>
    );
  });
  Story('With Custom Icon', () => {
    return (
      <Fragment>
        <p>
          The <JSXNode name="AlertLink" /> component can also be used with a custom icon.
          The icon can be overriden by passing a{' '}
          <JSXProperty name="trailingItems" value={'<IconMail />'} /> prop.
        </p>
        <AlertLink type="info" to={DUMMY_LINK} trailingItems={<IconMail />}>
          Clicking this link will not open in a new tab!
        </AlertLink>
      </Fragment>
    );
  });

  Story('AlertLink.Container', () => {
    return (
      <Fragment>
        <p>
          The <JSXNode name="AlertLink.Container" /> component is a container for one or
          multiple <JSXNode name="AlertLink" /> components. It manages margins between the
          links.
        </p>
        <AlertLink.Container>
          <AlertLink type="info" to={DUMMY_LINK}>
            Multiple AlertLinks
          </AlertLink>
          <AlertLink type="info" href={DUMMY_LINK} openInNewTab={false}>
            Are nicely spaced out
          </AlertLink>
          {/* eslint-disable-next-line */}
          <AlertLink type="info" onClick={() => window.alert('Clicked!')}>
            ... all of them
          </AlertLink>
        </AlertLink.Container>
      </Fragment>
    );
  });
});
