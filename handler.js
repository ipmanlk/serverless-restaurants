const { randomUUID } = require("crypto");
const AWS = require("aws-sdk");

const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.restaurants = async (event, context) => {
  // Insert restaurant
  if (event.httpMethod === "POST") {
    const restaurant = JSON.parse(event.body);
    const params = {
      TableName: "Restaurants",
      Item: restaurant,
    };
    try {
      await dynamodb.put(params).promise();
      return {
        statusCode: 201,
        body: JSON.stringify(restaurant),
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Could not save restaurant" }),
      };
    }
  }
  // Search restaurants
  else if (event.httpMethod === "GET") {
    const query = event.queryStringParameters;
    if (query && (query.name || query.location)) {
      let filterExpression = "";
      let expressionAttributeValues = {};
      if (query.name) {
        filterExpression += "contains(name, :name)";
        expressionAttributeValues[":name"] = query.name;
      }
      if (query.location) {
        if (filterExpression.length > 0) {
          filterExpression += " AND ";
        }
        filterExpression += "contains(location, :location)";
        expressionAttributeValues[":location"] = query.location;
      }
      const params = {
        TableName: "Restaurants",
        FilterExpression: filterExpression,
        ExpressionAttributeValues: expressionAttributeValues,
      };
      try {
        const result = await dynamodb.scan(params).promise();
        return {
          statusCode: 200,
          body: JSON.stringify(result.Items),
        };
      } catch (error) {
        return {
          statusCode: 500,
          body: JSON.stringify({ error: "Could not search restaurants" }),
        };
      }
    }
    // Get all restaurants
    else {
      try {
        const params = {
          TableName: "Restaurants",
        };
        const result = await dynamodb.scan(params).promise();
        return {
          statusCode: 200,
          body: JSON.stringify(result.Items),
        };
      } catch (error) {
        return {
          statusCode: 500,
          body: JSON.stringify({ error: "Could not retrieve restaurants" }),
        };
      }
    }
  }
};

exports.restaurantFood = async (event, context) => {
  // Create food
  if (event.httpMethod === "POST") {
    const food = JSON.parse(event.body);
    const params = {
      TableName: "Food",
      Item: food,
    };
    try {
      await dynamodb.put(params).promise();
      return {
        statusCode: 201,
        body: JSON.stringify(food),
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Could not save food" }),
      };
    }
  }
  // Get food in restaurant
  else if (event.httpMethod === "GET") {
    const restaurantId = event.pathParameters.restaurantId;
    const params = {
      TableName: "Food",
      FilterExpression: "restaurantId = :restaurantId",
      ExpressionAttributeValues: {
        ":restaurantId": restaurantId,
      },
    };
    try {
      const result = await dynamodb.scan(params).promise();
      return {
        statusCode: 200,
        body: JSON.stringify(result.Items),
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Could not retrieve food" }),
      };
    }
  }
};

exports.restaurantOrders = async (event, context) => {
  // Create order for a restaurant
  if (event.httpMethod === "POST" && event.path === "/orders/{restaurantId}") {
    try {
      const restaurantId = event.pathParameters.restaurantId;
      const order = JSON.parse(event.body);
      order.restaurantId = restaurantId;
      order.orderId = randomUUID();
      const params = {
        TableName: "Orders",
        Item: order,
      };
      await dynamodb.put(params).promise();
      return {
        statusCode: 201,
        body: JSON.stringify(order),
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Could not create order for the specified restaurant",
        }),
      };
    }
  }
  // Retrieve food orders per restaurant
  else if (
    event.httpMethod === "GET" &&
    event.path === "/orders/{restaurantId}"
  ) {
    try {
      const restaurantId = event.pathParameters.restaurantId;
      const params = {
        TableName: "Orders",
        FilterExpression: "restaurantId = :restaurantId",
        ExpressionAttributeValues: {
          ":restaurantId": restaurantId,
        },
      };
      const result = await dynamodb.scan(params).promise();
      return {
        statusCode: 200,
        body: JSON.stringify(result.Items),
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Could not retrieve orders for the specified restaurant",
        }),
      };
    }
  }
  // Retrieve a single order by id
  else if (event.httpMethod === "GET" && event.path === "/orders/{orderId}") {
    try {
      const orderId = event.pathParameters.orderId;
      const params = {
        TableName: "Orders",
        Key: {
          orderId: orderId,
        },
      };
      const result = await dynamodb.get(params).promise();
      if (result.Item) {
        return {
          statusCode: 200,
          body: JSON.stringify(result.Item),
        };
      } else {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: "Order not found" }),
        };
      }
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Could not retrieve order" }),
      };
    }
  }
  // Check order delivery progress
  else if (
    event.httpMethod === "GET" &&
    event.path === "/orders/{orderId}/progress"
  ) {
    try {
      const orderId = event.pathParameters.orderId;
      const params = {
        TableName: "Orders",
        Key: {
          orderId: orderId,
        },
      };
      const result = await dynamodb.get(params).promise();
      if (result.Item) {
        return {
          statusCode: 200,
          body: JSON.stringify({ progress: result.Item.deliveryProgress }),
        };
      } else {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: "Order not found" }),
        };
      }
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Could not retrieve delivery progress" }),
      };
    }
  } else {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: "Route not found" }),
    };
  }
};

// Get all food items in all restaurants along with the restaurant details
exports.food = async () => {
  try {
    const foodParams = {
      TableName: "Food",
    };

    // Get all food items
    const foodResult = await dynamodb.scan(foodParams).promise();
    const foodItems = foodResult.Items;

    // Get the restaurant for each food item
    const restaurantPromises = foodItems.map(async (foodItem) => {
      const restaurantId = foodItem.restaurantId;
      const restaurantParams = {
        TableName: "Restaurants",
        Key: {
          id: restaurantId,
        },
      };
      const restaurantResult = await dynamodb.get(restaurantParams).promise();
      const restaurant = restaurantResult.Item;
      return {
        foodItem,
        restaurant,
      };
    });

    // Wait for all restaurant queries to complete
    const result = await Promise.all(restaurantPromises);

    return result;
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Could not retrieve food with restaurants",
      }),
    };
  }
};
