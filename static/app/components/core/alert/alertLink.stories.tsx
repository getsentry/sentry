import {Fragment} from 'react';

import {AlertLink, type AlertLinkProps} from 'sentry/components/core/alert/alertLink';
import {IconMail} from 'sentry/icons';
import * as Storybook from 'sentry/stories';

import types from '!!type-loader!sentry/components/core/alert/alertLink';

const DUMMY_LINK = '/stories';

const ALERT_LINK_VARIANTS: Array<AlertLinkProps['type']> = [
  'info',
  'warning',
  'success',
  'error',
  'muted',
];

export default Storybook.story('AlertLink', (story, APIReference) => {
  APIReference(types.AlertLink);
  story('Default', () => {
    return (
      <Fragment>
        <p>
          The <Storybook.JSXNode name="AlertLink" /> component is a type of{' '}
          <Storybook.JSXNode name="Alert" />. The primary use case is when you want the
          entire alert to be a link.
        </p>
        <p>
          The default <Storybook.JSXNode name="AlertLink" /> looks like this:
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

  story('Internal, External, and Manual Links', () => {
    return (
      <Fragment>
        <p>
          The <Storybook.JSXNode name="AlertLink" /> component can be used as an external
          link, an internal link, or a manual link (by specifying a{' '}
          <Storybook.JSXProperty name="onClick" value /> prop). Currently, only the{' '}
          <Storybook.JSXNode name="ExternalLink" /> component supports the{' '}
          <Storybook.JSXProperty name="openInNewTab" value /> prop - this prop is not
          supported for internal or manual links.{' '}
        </p>
        <p>
          AlertLink as an external link using{' '}
          <Storybook.JSXProperty name="href" value={`https://santry.io${DUMMY_LINK}`} />
          and <Storybook.JSXProperty name="openInNewTab" value />:
        </p>
        <AlertLink type="info" href={`https://santry.io/${DUMMY_LINK}`} openInNewTab>
          Info Link
        </AlertLink>
        <p>
          AlertLink as an internal link using{' '}
          <Storybook.JSXProperty name="to" value={DUMMY_LINK} />:
        </p>
        <AlertLink type="info" to={DUMMY_LINK}>
          Info Link
        </AlertLink>
        <p>
          AlertLink as a manual link using{' '}
          <Storybook.JSXProperty
            name="onClick"
            value={`() => window.alert('Clicked!')`}
          />
          :
        </p>
        {/* eslint-disable-next-line no-alert */}
        <AlertLink type="info" onClick={() => window.alert('Clicked!')}>
          Info Link
        </AlertLink>
      </Fragment>
    );
  });
  story('With Custom Icon', () => {
    return (
      <Fragment>
        <p>
          The <Storybook.JSXNode name="AlertLink" /> component can also be used with a
          custom icon. The icon can be overriden by passing a{' '}
          <Storybook.JSXProperty name="trailingItems" value={'<IconMail />'} /> prop.
        </p>
        <AlertLink type="info" to={DUMMY_LINK} trailingItems={<IconMail />}>
          Clicking this link will not open in a new tab!
        </AlertLink>
      </Fragment>
    );
  });

  story('AlertLink.Container', () => {
    return (
      <Fragment>
        <p>
          The <Storybook.JSXNode name="AlertLink.Container" /> component is a container
          for one or multiple <Storybook.JSXNode name="AlertLink" /> components. It
          manages margins between the links.
        </p>
        <AlertLink.Container>
          <AlertLink type="info" to={DUMMY_LINK}>
            Multiple AlertLinks
          </AlertLink>
          <AlertLink type="info" href={DUMMY_LINK} openInNewTab={false}>
            Are nicely spaced out
          </AlertLink>
          {/* eslint-disable-next-line no-alert */}
          <AlertLink type="info" onClick={() => window.alert('Clicked!')}>
            ... all of them
          </AlertLink>
        </AlertLink.Container>
      </Fragment>
    );
  });
});
