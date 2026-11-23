import {useQuery} from '@tanstack/react-query';

import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {apiOptions} from 'sentry/utils/api/apiOptions';

import {AuthPageLayout} from './authPageLayout';
import PlainAuthLayout from './plainAuthLayout';
import {useAuthPageLoading} from './useAuthPageLoading';

function PreparingPage() {
  const query = useQuery(
    apiOptions.as<Record<PropertyKey, unknown>>()('/auth/config/', {staleTime: 0})
  );
  useAuthPageLoading(query.isPending);

  return <Text aria-busy={query.isPending}>Authentication content</Text>;
}

const initialRouterConfig = {
  route: '/',
  location: {pathname: '/oauth/device/'},
  children: [{path: 'oauth/device/', element: <PreparingPage />}],
};

it('keeps plain authentication mounted and hidden until page data is ready', async () => {
  const delay = Promise.withResolvers<void>();
  MockApiClient.addMockResponse({
    url: '/auth/config/',
    body: {},
    asyncDelay: delay.promise,
  });
  render(<PlainAuthLayout />, {initialRouterConfig});
  const content = screen.getByText('Authentication content');
  const page = content.closest('[aria-hidden]');
  expect(page).toHaveAttribute('aria-hidden', 'true');

  await act(() => {
    delay.resolve();
    return delay.promise;
  });

  await waitFor(() => expect(page).toHaveAttribute('aria-hidden', 'false'));
  expect(screen.getByText('Authentication content')).toBe(content);
});

it('waits for artwork as well as page data when the layout requests it', async () => {
  const config = MockApiClient.addMockResponse({url: '/auth/config/', body: {}});
  const {rerender} = render(
    <AuthPageLayout isArtworkLoading>
      {({content}) => <Container>{content}</Container>}
    </AuthPageLayout>,
    {initialRouterConfig}
  );
  await waitFor(() => expect(config).toHaveBeenCalled());
  await waitFor(() =>
    expect(screen.getByText('Authentication content')).toHaveAttribute(
      'aria-busy',
      'false'
    )
  );
  const page = screen.getByText('Authentication content').closest('[aria-hidden]');
  expect(page).toHaveAttribute('aria-hidden', 'true');

  rerender(
    <AuthPageLayout>{({content}) => <Container>{content}</Container>}</AuthPageLayout>
  );
  await waitFor(() => expect(page).toHaveAttribute('aria-hidden', 'false'));
});
