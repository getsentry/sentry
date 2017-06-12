from __future__ import absolute_import, unicode_literals

from django.http import HttpResponseBadRequest
from django.shortcuts import render_to_response
from django.views.decorators.csrf import csrf_exempt

from debug_toolbar.panels.sql.forms import SQLSelectForm


@csrf_exempt
def sql_select(request):
    """Returns the output of the SQL SELECT statement"""
    form = SQLSelectForm(request.POST or None)

    if form.is_valid():
        sql = form.cleaned_data['raw_sql']
        params = form.cleaned_data['params']
        cursor = form.cursor
        cursor.execute(sql, params)
        headers = [d[0] for d in cursor.description]
        result = cursor.fetchall()
        cursor.close()
        context = {
            'result': result,
            'sql': form.reformat_sql(),
            'duration': form.cleaned_data['duration'],
            'headers': headers,
            'alias': form.cleaned_data['alias'],
        }
        # Using render_to_response avoids running global context processors.
        return render_to_response('debug_toolbar/panels/sql_select.html', context)
    return HttpResponseBadRequest('Form errors')


@csrf_exempt
def sql_explain(request):
    """Returns the output of the SQL EXPLAIN on the given query"""
    form = SQLSelectForm(request.POST or None)

    if form.is_valid():
        sql = form.cleaned_data['raw_sql']
        params = form.cleaned_data['params']
        vendor = form.connection.vendor
        cursor = form.cursor

        if vendor == 'sqlite':
            # SQLite's EXPLAIN dumps the low-level opcodes generated for a query;
            # EXPLAIN QUERY PLAN dumps a more human-readable summary
            # See http://www.sqlite.org/lang_explain.html for details
            cursor.execute("EXPLAIN QUERY PLAN %s" % (sql,), params)
        elif vendor == 'postgresql':
            cursor.execute("EXPLAIN ANALYZE %s" % (sql,), params)
        else:
            cursor.execute("EXPLAIN %s" % (sql,), params)

        headers = [d[0] for d in cursor.description]
        result = cursor.fetchall()
        cursor.close()
        context = {
            'result': result,
            'sql': form.reformat_sql(),
            'duration': form.cleaned_data['duration'],
            'headers': headers,
            'alias': form.cleaned_data['alias'],
        }
        # Using render_to_response avoids running global context processors.
        return render_to_response('debug_toolbar/panels/sql_explain.html', context)
    return HttpResponseBadRequest('Form errors')


@csrf_exempt
def sql_profile(request):
    """Returns the output of running the SQL and getting the profiling statistics"""
    form = SQLSelectForm(request.POST or None)

    if form.is_valid():
        sql = form.cleaned_data['raw_sql']
        params = form.cleaned_data['params']
        cursor = form.cursor
        result = None
        headers = None
        result_error = None
        try:
            cursor.execute("SET PROFILING=1")  # Enable profiling
            cursor.execute(sql, params)  # Execute SELECT
            cursor.execute("SET PROFILING=0")  # Disable profiling
            # The Query ID should always be 1 here but I'll subselect to get
            # the last one just in case...
            cursor.execute("""
  SELECT  *
    FROM  information_schema.profiling
   WHERE  query_id = (
          SELECT  query_id
            FROM  information_schema.profiling
        ORDER BY  query_id DESC
           LIMIT  1
        )
""")
            headers = [d[0] for d in cursor.description]
            result = cursor.fetchall()
        except Exception:
            result_error = "Profiling is either not available or not supported by your database."
        cursor.close()
        context = {
            'result': result,
            'result_error': result_error,
            'sql': form.reformat_sql(),
            'duration': form.cleaned_data['duration'],
            'headers': headers,
            'alias': form.cleaned_data['alias'],
        }
        # Using render_to_response avoids running global context processors.
        return render_to_response('debug_toolbar/panels/sql_profile.html', context)
    return HttpResponseBadRequest('Form errors')
