/**
 * A full page load of a web application.
 */
declare const BROWSER_PAGELOAD_SPAN_OP = "pageload";
/**
 * Client-side browser history change in a web application.
 */
declare const BROWSER_NAVIGATION_SPAN_OP = "navigation";
/**
 * Resource as per [Performance Resource Timing](https://w3c.github.io/resource-timing/#sec-performanceresourcetiming). Defaults to resource.other if resource cannot be indentified.
 */
declare const BROWSER_RESOURCE_SPAN_OP = "resource";
declare const BROWSER_RESOURCE_SCRIPT_SPAN_OP = "resource.script";
declare const BROWSER_RESOURCE_LINK_SPAN_OP = "resource.link";
declare const BROWSER_RESOURCE_IMG_SPAN_OP = "resource.img";
declare const BROWSER_RESOURCE_CSS_SPAN_OP = "resource.css";
declare const BROWSER_RESOURCE_OTHER_SPAN_OP = "resource.other";
/**
 * Usage of browser APIs or functionality
 */
declare const BROWSER_BROWSER_SPAN_OP = "browser";
declare const BROWSER_BROWSER_PAINT_SPAN_OP = "browser.paint";
/**
 * Operations related to browser UI
 */
declare const BROWSER_UI_SPAN_OP = "ui";
/**
 * A task that is taken on the main UI thread. Typically used to indicate to users about things like the [Long Tasks API](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming).
 */
declare const BROWSER_UI_TASK_SPAN_OP = "ui.task";
declare const BROWSER_UI_RENDER_SPAN_OP = "ui.render";
declare const BROWSER_UI_ACTION_SPAN_OP = "ui.action";
declare const BROWSER_UI_ACTION_CLICK_SPAN_OP = "ui.action.click";
declare const BROWSER_UI_REACT_SPAN_OP = "ui.react";
declare const BROWSER_UI_REACT_MOUNT_SPAN_OP = "ui.react.mount";
declare const BROWSER_UI_REACT_RENDER_SPAN_OP = "ui.react.render";
declare const BROWSER_UI_REACT_UPDATE_SPAN_OP = "ui.react.update";
declare const BROWSER_UI_VUE_SPAN_OP = "ui.vue";
declare const BROWSER_UI_SVELTE_SPAN_OP = "ui.svelte";
declare const BROWSER_UI_ANGULAR_SPAN_OP = "ui.angular";
declare const BROWSER_UI_EMBER_SPAN_OP = "ui.ember";
declare const BROWSER_UI_LIVEWIRE_SPAN_OP = "ui.livewire";
declare const DATABASE_DB_SPAN_OP = "db";
declare const DATABASE_DB_QUERY_SPAN_OP = "db.query";
declare const DATABASE_CACHE_SPAN_OP = "cache";
declare const FAAS_HTTP_SPAN_OP = "http";
declare const FAAS_GRPC_SPAN_OP = "grpc";
declare const FAAS_FUNCTION_GCP_SPAN_OP = "function.gcp";
declare const FAAS_FUNCTION_AWS_SPAN_OP = "function.aws";
declare const FAAS_FUNCTION_AZURE_SPAN_OP = "function.azure";
/**
 * A chat interaction with a generative AI model
 */
declare const GEN_AI_CHAT_SPAN_OP = "chat";
/**
 * Execution of a tool or function by a generative AI model
 */
declare const GEN_AI_EXECUTE_TOOL_SPAN_OP = "execute_tool";
/**
 * Handoff of control between different AI agents or components
 */
declare const GEN_AI_HANDOFF_SPAN_OP = "handoff";
/**
 * Invocation of an AI agent to perform a task
 */
declare const GEN_AI_INVOKE_AGENT_SPAN_OP = "invoke_agent";
/**
 * A general point-in-time span indicating an event
 */
declare const GENERAL_MARK_SPAN_OP = "mark";
/**
 * The time it took for a set of instructions to execute
 */
declare const GENERAL_FUNCTION_SPAN_OP = "function";
declare const MOBILE_APP_SPAN_OP = "app";
declare const MOBILE_UI_SPAN_OP = "ui";
declare const MOBILE_NAVIGATION_SPAN_OP = "navigation";
declare const MOBILE_FILE_SPAN_OP = "file";
declare const MOBILE_SERIALIZE_SPAN_OP = "serialize";
declare const MOBILE_HTTP_SPAN_OP = "http";
/**
 * A general point-in-time span indicating an event
 */
declare const WEB_SERVER_HTTP_SPAN_OP = "http";
declare const WEB_SERVER_HTTP_CLIENT_SPAN_OP = "http.client";
declare const WEB_SERVER_HTTP_SERVER_SPAN_OP = "http.server";
declare const WEB_SERVER_WEBSOCKET_SPAN_OP = "websocket";
declare const WEB_SERVER_RPC_SPAN_OP = "rpc";
declare const WEB_SERVER_GRPC_SPAN_OP = "grpc";
declare const WEB_SERVER_GRAPHQL_SPAN_OP = "graphql";
declare const WEB_SERVER_SUBPROCESS_SPAN_OP = "subprocess";
declare const WEB_SERVER_MIDDLEWARE_SPAN_OP = "middleware";
declare const WEB_SERVER_VIEW_SPAN_OP = "view";
declare const WEB_SERVER_TEMPLATE_SPAN_OP = "template";
declare const WEB_SERVER_FUNCTION_SPAN_OP = "function";
declare const WEB_SERVER_FUNCTION_REMIX_SPAN_OP = "function.remix";
declare const WEB_SERVER_FUNCTION_NEXTJS_SPAN_OP = "function.nextjs";
declare const WEB_SERVER_SERIALIZE_SPAN_OP = "serialize";
declare const WEB_SERVER_CONSOLE_SPAN_OP = "console";
declare const WEB_SERVER_FILE_SPAN_OP = "file";
declare const WEB_SERVER_APP_SPAN_OP = "app";

export { BROWSER_BROWSER_PAINT_SPAN_OP, BROWSER_BROWSER_SPAN_OP, BROWSER_NAVIGATION_SPAN_OP, BROWSER_PAGELOAD_SPAN_OP, BROWSER_RESOURCE_CSS_SPAN_OP, BROWSER_RESOURCE_IMG_SPAN_OP, BROWSER_RESOURCE_LINK_SPAN_OP, BROWSER_RESOURCE_OTHER_SPAN_OP, BROWSER_RESOURCE_SCRIPT_SPAN_OP, BROWSER_RESOURCE_SPAN_OP, BROWSER_UI_ACTION_CLICK_SPAN_OP, BROWSER_UI_ACTION_SPAN_OP, BROWSER_UI_ANGULAR_SPAN_OP, BROWSER_UI_EMBER_SPAN_OP, BROWSER_UI_LIVEWIRE_SPAN_OP, BROWSER_UI_REACT_MOUNT_SPAN_OP, BROWSER_UI_REACT_RENDER_SPAN_OP, BROWSER_UI_REACT_SPAN_OP, BROWSER_UI_REACT_UPDATE_SPAN_OP, BROWSER_UI_RENDER_SPAN_OP, BROWSER_UI_SPAN_OP, BROWSER_UI_SVELTE_SPAN_OP, BROWSER_UI_TASK_SPAN_OP, BROWSER_UI_VUE_SPAN_OP, DATABASE_CACHE_SPAN_OP, DATABASE_DB_QUERY_SPAN_OP, DATABASE_DB_SPAN_OP, FAAS_FUNCTION_AWS_SPAN_OP, FAAS_FUNCTION_AZURE_SPAN_OP, FAAS_FUNCTION_GCP_SPAN_OP, FAAS_GRPC_SPAN_OP, FAAS_HTTP_SPAN_OP, GENERAL_FUNCTION_SPAN_OP, GENERAL_MARK_SPAN_OP, GEN_AI_CHAT_SPAN_OP, GEN_AI_EXECUTE_TOOL_SPAN_OP, GEN_AI_HANDOFF_SPAN_OP, GEN_AI_INVOKE_AGENT_SPAN_OP, MOBILE_APP_SPAN_OP, MOBILE_FILE_SPAN_OP, MOBILE_HTTP_SPAN_OP, MOBILE_NAVIGATION_SPAN_OP, MOBILE_SERIALIZE_SPAN_OP, MOBILE_UI_SPAN_OP, WEB_SERVER_APP_SPAN_OP, WEB_SERVER_CONSOLE_SPAN_OP, WEB_SERVER_FILE_SPAN_OP, WEB_SERVER_FUNCTION_NEXTJS_SPAN_OP, WEB_SERVER_FUNCTION_REMIX_SPAN_OP, WEB_SERVER_FUNCTION_SPAN_OP, WEB_SERVER_GRAPHQL_SPAN_OP, WEB_SERVER_GRPC_SPAN_OP, WEB_SERVER_HTTP_CLIENT_SPAN_OP, WEB_SERVER_HTTP_SERVER_SPAN_OP, WEB_SERVER_HTTP_SPAN_OP, WEB_SERVER_MIDDLEWARE_SPAN_OP, WEB_SERVER_RPC_SPAN_OP, WEB_SERVER_SERIALIZE_SPAN_OP, WEB_SERVER_SUBPROCESS_SPAN_OP, WEB_SERVER_TEMPLATE_SPAN_OP, WEB_SERVER_VIEW_SPAN_OP, WEB_SERVER_WEBSOCKET_SPAN_OP };
