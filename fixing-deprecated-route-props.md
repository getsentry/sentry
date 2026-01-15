The steps are:

1. Identify a route file where `deprecatedRouteProps: true` is defined. Look in these files, but there’s also a big list below:
   1. https://github.com/getsentry/sentry/blob/master/static/app/routes.tsx#L25
   2. https://github.com/getsentry/sentry/blob/master/static/gsAdmin/routes.tsx#L28
   3. https://github.com/getsentry/sentry/blob/master/static/gsApp/hooks/rootRoutes.tsx#L16
   4. https://github.com/getsentry/sentry/blob/master/static/gsApp/hooks/settingsRoutes.tsx#L16
2. Updating the code so it doesn’t accept props anymore.
   1. See below for tips/cases you’ll find.
   2. You might also need to update tests to remove manual mocks, and use `render()` with it’s [built-in context passing](https://develop.sentry.dev/frontend/using-rtl/#use-our-built-in-contexts).
3. Set `deprecatedRouteProps: false`
   1. Well the default is `false`, so just delete that line
   2. Multiple routes (ie: redirects) can point to the same view file, update them all!

### Common cases you’ll encounter & what to do.

1. **Updating Tests**

   Test files will usually need to be updated. The easiest thing is to remove the extra props.

   You might also need to pass in props related to location and the route:

   ```diff
     render(
       <MyView
   -     params={params}
   -     route={{}}
   -     router={router}
   -     routes={router.routes}
   -     routeParams={router.params}
   -     location={router.location}
       />,
   +   {
   +     initialRouterConfig: {
   +       pathname: '/organizations/org-slug/my/page/',
   +     },
   +     route: '/organizations/:orgId/my/page/',
   +   },
     );
   ```

2. **Functional Component**

   If the route file is already a functional component the change is really easy, just replace the props with calls to the various hooks:

   ```diff
   # myView.tsx
   - export default function MyView({ location, params, route, organization }: RouteComponentProps) {
   + export default function MyView() {
   +   const location = useLocation();
   +   const params = useParams();
   +   const route = useRouteMatch();
   +   const organization = useOrganization();
     ...

   # routes.tsx
     {
       path: '/organizations/:orgId/my/page/',
       component: make(() => import('sentry/views/myView')),
   -   deprecatedRouteProps: true,
     },
   ```

3. **Functional Component - with Children**

   If `children` is one of the props then you can replace that with `<Outlet />`

   You can also pass props into the child through the outlet: `<Outlet orgSlug="sentry" />` and then read it back with `useOutletContext` ([docs](https://reactrouter.com/api/hooks/useOutletContext)). Write a typed hook to read back the data
   - Example

     ```tsx
     function useOrgSlugFromOutletContext(): string {
       const {orgSlug} = useOutletContext<{orgSlug: string}>();
       return orgSlug;
     }
     ```

   ```diff
   # myView.tsx
   + import {Outlet} from 'react-router-dom';

   - export default function MyView({ children }: RouteComponentProps) {
   -   return children;
   + export default function MyView() {
   +   return <Outlet />;

   # routes.tsx
     {
       path: '/organizations/:orgId/my/page/',
       component: make(() => import('sentry/views/myView')),
   -   deprecatedRouteProps: true,
     },
   ```

4. Functional Component - Nested with props

   If there’s a parent component passing props down to a child component then our `deprecatedRouteProps` field actually doesn’t detect this properly. Just remove the props from `RouteComponentProps` and leave the rest.

   Leaving a comment in the routes file is a good idea so it’s easier for the next person to see!

   ```tsx
   # myView.tsx
   - export default function MyView({ organization, project }: RouteComponentProps & { project: Project }) {
   + export default function MyView({ project }: { project: Project }) {
   +   const organization = useOrganization();

   # routes.tsx
     {
       path: '/organizations/:orgId/my/page/',
       component: make(() => import('sentry/views/myView')),
   -  deprecatedRouteProps: true,
   +  deprecatedRouteProps: true, // still needed because the parent passes `project` to the child
     },
   ```

5. **Class Components**

   You’re encouraged to try to convert any class components into functional components, then use the hooks and <Outlet> as above. But it’s not required!

   If you’re not about to convert something that’s ok, instead add a little functional wrapper around the class component, put the hooks in there, and then pass props down.

   The benefit of this is that we can localize the prop passing so it’s only related to the class components that need it. We’ll be able to remove the global shims this way.

   ```tsx
     class MyView({children, location, params, route, organization}: RouteComponentProps) {
       ...
     }

   - export default MyView;
   + export function MyViewWrapper() {
   +   const location = useLocation();
   +   const params = useParams();
   +   const route = useRouteMatch();
   +   const organization = useOrganization();
   +   return <MyView
   +     location={location}
   +     params={params}
   +     route={route}
   +     organization={organization}
   +   >
   +     <Outlet />
   +   </MyView>
   + }
   ```
