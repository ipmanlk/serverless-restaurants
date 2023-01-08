const { randomUUID } = require("crypto");
const AWS = require("aws-sdk");

const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.restaurants = async (event, context) => {
  // Insert restaurant
  if (event.httpMethod === "POST") {
    const restaurant = JSON.parse(event.body);
    restaurant.id = randomUUID();
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
    } catch (e) {
      console.error(e);
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
        filterExpression += "contains(#n, :name)";
        expressionAttributeValues[":name"] = query.name;
      }
      if (query.location) {
        if (filterExpression.length > 0) {
          filterExpression += " AND ";
        }
        filterExpression += "contains(#l, :location)";
        expressionAttributeValues[":location"] = query.location;
      }
      const params = {
        TableName: "Restaurants",
        FilterExpression: filterExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: { "#n": "name", "#l": "location" },
      };
      try {
        const result = await dynamodb.scan(params).promise();
        return {
          statusCode: 200,
          body: JSON.stringify(result.Items),
        };
      } catch (e) {
        console.error(e);
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
      } catch (e) {
        console.error(e);
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
    const restaurantId = event.pathParameters.restaurantId;
    const food = JSON.parse(event.body);
    food.id = randomUUID();
    food.restaurantId = restaurantId;
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
    } catch (e) {
      console.error(e);
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
    } catch (e) {
      console.error(e);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Could not retrieve food" }),
      };
    }
  }
};

exports.createOrder = async (event, context) => {
  try {
    const order = JSON.parse(event.body);
    order.id = randomUUID();
    const params = {
      TableName: "Orders",
      Item: order,
    };
    await dynamodb.put(params).promise();
    return {
      statusCode: 201,
      body: JSON.stringify(order),
    };
  } catch (e) {
    console.error(e);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Could not create order for the specified restaurant",
      }),
    };
  }
};

exports.getOrder = async (event, context) => {
  try {
    const orderId = event.pathParameters.orderId;
    const params = {
      TableName: "Orders",
      Key: {
        id: orderId,
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
  } catch (e) {
    console.error(e);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not retrieve order" }),
    };
  }
};

exports.getRestaurantOrders = async (event, context) => {
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
  } catch (e) {
    console.error(e);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Could not retrieve orders for the specified restaurant",
      }),
    };
  }
};

// Get all food items in all restaurants along with the restaurant details
exports.getFoodWithRestaurants = async () => {
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
  } catch (e) {
    console.error(e);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Could not retrieve food with restaurants",
      }),
    };
  }
};
