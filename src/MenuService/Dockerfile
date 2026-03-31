FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["src/MenuService/MenuService.csproj", "src/MenuService/"]
RUN dotnet restore "src/MenuService/MenuService.csproj"
COPY . .
WORKDIR "/src/src/MenuService"
RUN dotnet publish "MenuService.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "MenuService.dll"]