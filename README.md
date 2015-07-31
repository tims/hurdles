[![Build Status](https://travis-ci.org/tims/hurdles.svg)](https://travis-ci.org/tims/hurdles)

I am interested in Facebook's Relay project, which is a thing for fetching data from a React app with composable queries.

I'm messing around trying to implement that basic idea without getting fancy.

Hurdles takes a tree of **queries** and calls **handlers** only once for each common query.

This is useful for a single page javascript app that has a large tree of components that may require access to some of
the same data from different places in the hierarchy.

One option would be to just call services for the required data from within components that need the data, 
so from the leaves of the tree. The drawback is in a large codebase how do you find all the places where 
a service is called? And how do you optimise service calls making redundant calls for the same data?

Another option is to have common parent component call services for the required data and pass that to it's children.
The drawback is that every time children need more or different data the parent components and any intermediate components
will have to be update to pass in the new data.

A better solution is to have each component declare what it needs to it's parent, and pass data to their 
children without inspection. A root component can manage the fetching of data and knowing the whole tree, can 
optimise queries to fetch things only once.

That's what Relay, and Hurdles tries to do. 

# Usage
 
## Setup the handlers

    // Handlers should return a promise
    var handlers = {
        user: function(shape, queryParams, type) { 
            return Promise.resolve({"id":1,"name":"Tim","post_count":3});
        }
    };

## Run a query 

    hurdles.run(query).then(function (output) {
        console.log(output);
    });


## Example queryies

###  Simple query

handlers 
    
    var handlers = {
        user: function(shape, queryParams, type) { 
            return Promise.resolve({"id":1,"name":"Tim","post_count":3});
        }
    }
    
Query

    var query = {
         "user()": {
             "id": null,
             "name": null,
             "post_count": null
         }
    }

Output

    {
        "user": {
            "id": 1,
            "name": "Tim",
            "post_count": 3
        }
    }

### Nested query where child query receives parent query's output as a query parameter

Handlers
 
    var handlers = {
        user: function(shape, queryParams, type) { 
            return Promise.resolve({"id":1,"name":"Tim","post_count":3}); 
        },
        posts: function (shape, queryParams, type) {
            if (queryParams.user.id === 1) {
                return Promise.resolve([{text: 'first'}, {text: 'second'}]);
            } else { Promise.reject(':(')}
        }
    };


Input
    
    var query = {
        "user()": {
            "id": null,
            "name": null,
            "posts[]": {
                "_": {
                    "user": null
                },
                "text": null
            }
        }
    }

Output
    
    {
        "user": {
            "id": 1,
            "name": "Tim",
            "posts": [
                {"text": "first"},
                {"text": "second"}
            ]
        }
    }



# Query types

You can set a type for each query which will be passed to it's a handler. By default a query is of type "get". 
It's up to the handler what it does with that type. 

For example you can set the query type as "new" by: 

    {
        "new Foo()": {
            "_": { "name": "Björk" }
            "id": null    
        }
    }
 
 The Foo handler will be called with `handler(shape, queryParams, type)` which in this case is 
 `handler({"id": null}, {"name": "Björk"}, "new")`


Type can match `get|new|update|delete`.

## TODO 

At the moment there's no real difference between an `get`, `new` or `delete`. 
It should at least invalidate the cache for the known dependencies of the query.
