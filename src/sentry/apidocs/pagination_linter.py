import ast


class FindPaginateInGetMethodVisitor(ast.NodeVisitor):
    def __init__(self, class_name):
        self.class_name = class_name
        self.function_defs = {}  # Maps function names to their AST nodes
        self.called_by_get = []  # List of functions called directly by 'get'
        self.visited = set()  # Prevent infinite recursion
        self.found = False

    def visit_ClassDef(self, node):
        if node.name == self.class_name:
            # Pre-process to map function names to their nodes
            for n in node.body:
                if isinstance(n, ast.FunctionDef):
                    self.function_defs[n.name] = n
            self.generic_visit(node)

    def visit_FunctionDef(self, node):
        if node.name == "get":
            self.generic_visit(node)  # Visit to find all direct calls
            # Now recursively visit all functions called by 'get'
            for func_name in self.called_by_get:
                self.visit_function_calls(func_name)
        elif node.name in self.function_defs:  # Prevent revisiting from the class level
            super().generic_visit(node)  # Normal traversal for other methods

    def visit_Call(self, node):
        if (
            isinstance(node.func, ast.Attribute)
            and node.func.attr == "paginate"
            and isinstance(node.func.value, ast.Name)
            and node.func.value.id == "self"
        ):
            self.found = True
        elif isinstance(node.func, ast.Name):
            # Check if this function call is within 'get'
            if node.func.id in self.function_defs and not self.found:
                self.called_by_get.append(node.func.id)
        self.generic_visit(node)

    def visit_function_calls(self, func_name):
        if func_name in self.visited or self.found:  # Avoid infinite loops or stop if found
            return
        self.visited.add(func_name)
        node = self.function_defs.get(func_name)
        if node:
            for n in ast.walk(node):
                if (
                    isinstance(n, ast.Call)
                    and isinstance(n.func, ast.Attribute)
                    and n.func.attr == "paginate"
                    and isinstance(n.func.value, ast.Name)
                    and n.func.value.id == "self"
                ):
                    self.found = True
                    return  # Stop as soon as we find a paginate call
                elif (
                    isinstance(n, ast.Call)
                    and isinstance(n.func, ast.Name)
                    and n.func.id in self.function_defs
                ):
                    self.visit_function_calls(n.func.id)  # Recursively check this function


def find_method_and_check_paginate(content, class_name) -> bool:
    with open(content) as file:
        file_content = file.read()

    tree = ast.parse(file_content)
    visitor = FindPaginateInGetMethodVisitor(class_name)
    visitor.visit(tree)

    return visitor.found
